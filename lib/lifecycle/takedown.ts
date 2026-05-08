import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/client'
import { renderTakedownFinal } from '@/lib/email/templates/takedown-final'
import { removeDomain as removeVercelDomain } from '@/lib/vercel/domains'
import type { LifecycleProfileRow } from './types'

// Takedown finalization. Two-stage flow:
//
//   1. status flips to 'taken_down' (done by agent 6 + my expiry handler;
//      see Events.TAKEDOWN_REQUESTED). Public surfaces revalidate, the
//      "we removed your profile" email goes out — but storage objects and
//      DB rows are kept intact during a cooling period so we can revert.
//
//   2. After TAKEDOWN_COOLING_DAYS (default 30, env-configurable), the
//      daily takedown cron calls `finalizeTakedown(profile_id)` for each
//      profile whose oldest takedowns row is past the cooling deadline.
//      That hard-deletes photos, social_links, articles; releases any
//      bespoke domain from Vercel; anonymizes the profiles row (keeping
//      the id for FK audit-trail integrity); and emails the customer that
//      removal is complete.
//
// Anonymizing instead of deleting preserves audit chains in payments,
// takedowns, and tc_acceptances (all of which have FKs into profiles
// with ON DELETE CASCADE). A real DELETE would wipe the takedown row
// itself — we want that history to survive so we can answer "did this
// profile ever exist and when did we remove it?"

const COOLING_DAYS_ENV = 'TAKEDOWN_COOLING_DAYS'
const DEFAULT_COOLING_DAYS = 30

export function coolingDays(): number {
  const raw = process.env[COOLING_DAYS_ENV]
  if (!raw) return DEFAULT_COOLING_DAYS
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COOLING_DAYS
}

export interface CooledProfile {
  profile_id: string
  user_id: string | null
  display_name: string
  bespoke_domain: string | null
  oldest_takedown_at: string
}

// Find profiles in 'taken_down' state whose earliest takedowns row is older
// than the cooling period AND that haven't been finalized yet. We scan in
// two steps: first the candidate profiles, then per-profile we look up the
// earliest takedowns row to confirm cooling.
export async function findCooledTakedowns(): Promise<CooledProfile[]> {
  const sb = createAdminClient()
  const cooledBefore = new Date(
    Date.now() - coolingDays() * 24 * 60 * 60 * 1000,
  ).toISOString()
  const { data: candidates, error } = await sb
    .from('profiles')
    .select('id, user_id, display_name, bespoke_domain, takedown_finalized_at')
    .eq('status', 'taken_down')
    .is('takedown_finalized_at', null)
  if (error) throw new Error(`findCooledTakedowns: ${error.message}`)
  const out: CooledProfile[] = []
  for (const row of (candidates ?? []) as Array<
    Pick<LifecycleProfileRow, 'id' | 'user_id' | 'display_name' | 'bespoke_domain' | 'takedown_finalized_at'>
  >) {
    const { data: tds, error: tdErr } = await sb
      .from('takedowns')
      .select('created_at')
      .eq('profile_id', row.id)
      .order('created_at', { ascending: true })
      .limit(1)
    if (tdErr) throw new Error(`findCooledTakedowns(td): ${tdErr.message}`)
    const oldest = tds?.[0]?.created_at as string | undefined
    if (!oldest) continue
    if (oldest > cooledBefore) continue
    out.push({
      profile_id: row.id,
      user_id: row.user_id,
      display_name: row.display_name,
      bespoke_domain: row.bespoke_domain,
      oldest_takedown_at: oldest,
    })
  }
  return out
}

// Hard-deletes assets, anonymizes the profiles row, releases bespoke
// domain, sends the final-removal email, stamps takedown_finalized_at.
//
// SAFETY: only runs if the profile is currently 'taken_down' AND has at
// least one takedowns row. Caller (cron) has already checked the cooling
// period; we re-assert state here as a belt-and-suspenders guard.
export async function finalizeTakedown(profile_id: string): Promise<void> {
  if (!profile_id) throw new Error('finalizeTakedown: profile_id required')
  const sb = createAdminClient()

  const { data: profile, error: pErr } = await sb
    .from('profiles')
    .select('id, user_id, display_name, status, bespoke_domain')
    .eq('id', profile_id)
    .single()
  if (pErr) throw new Error(`finalizeTakedown(load): ${pErr.message}`)
  if (profile.status !== 'taken_down') {
    throw new Error(
      `finalizeTakedown: profile ${profile_id} is in status '${profile.status}', not 'taken_down'`,
    )
  }
  const { count: tdCount } = await sb
    .from('takedowns')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile_id)
  if (!tdCount || tdCount < 1) {
    throw new Error(
      `finalizeTakedown: refusing to finalize ${profile_id} with no takedowns row`,
    )
  }

  // Resolve email BEFORE we delete anything (we still want to mail them).
  let email: string | null = null
  if (profile.user_id) {
    const { data: ures } = await sb.auth.admin.getUserById(profile.user_id)
    email = ures.user?.email ?? null
  }

  // 1. Photos: storage objects + DB rows.
  const { data: photoRows } = await sb
    .from('photos')
    .select('id, storage_path')
    .eq('profile_id', profile_id)
  const storagePaths = (photoRows ?? []).map((p) => p.storage_path).filter(Boolean)
  if (storagePaths.length) {
    const { error: stErr } = await sb.storage.from('photos').remove(storagePaths)
    if (stErr) {
      // Storage removal failures shouldn't abort the rest — log and continue.
      // The cron will pick up partial finalizations on a future run if we
      // don't stamp takedown_finalized_at, but here we want to make progress.
       
      console.warn(
        `finalizeTakedown: storage cleanup partial for ${profile_id}: ${stErr.message}`,
      )
    }
  }
  await sb.from('photos').delete().eq('profile_id', profile_id)
  await sb.from('social_links').delete().eq('profile_id', profile_id)
  await sb.from('articles').delete().eq('profile_id', profile_id)

  // 2. Bespoke domain: detach from Vercel. Don't release at registrar —
  //    we'd need an explicit Porkbun "release" call; instead we let
  //    auto-renew lapse (whoisprivacy was on, so no PII exposure).
  if (profile.bespoke_domain) {
    try {
      await removeVercelDomain(profile.bespoke_domain)
    } catch (e) {
       
      console.warn(
        `finalizeTakedown: vercel detach failed for ${profile.bespoke_domain}:`,
        e,
      )
    }
  }

  // 3. Anonymize profile row (don't delete — preserves takedowns FK chain).
  const { error: upErr } = await sb
    .from('profiles')
    .update({
      bio: '',
      tagline: null,
      display_name: '[removed]',
      bespoke_domain: null,
      takedown_finalized_at: new Date().toISOString(),
    } as never)
    .eq('id', profile_id)
  if (upErr) throw new Error(`finalizeTakedown(anonymize): ${upErr.message}`)

  // 4. Email customer.
  if (email) {
    try {
      await sendEmail({
        to: email,
        email: renderTakedownFinal({ display_name: profile.display_name }),
        idempotencyKey: `takedown-final:${profile_id}`,
      })
    } catch (e) {
       
      console.warn(`finalizeTakedown: email failed for ${profile_id}:`, e)
    }
  }
}
