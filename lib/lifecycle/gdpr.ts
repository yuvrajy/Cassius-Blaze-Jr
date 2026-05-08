import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeDomain as removeVercelDomain } from '@/lib/vercel/domains'
import { sendEmail } from '@/lib/email/client'
import { renderTakedownFinal } from '@/lib/email/templates/takedown-final'

// GDPR right-to-be-forgotten. Bypasses the 30-day cooling period and
// hard-deletes everything tied to the profile, including the auth.users
// row.
//
// AUDIT TRAIL TRADE-OFF: agent 1's schema sets ON DELETE CASCADE on the
// FKs from photos, social_links, articles, takedowns, payments, and
// tc_acceptances into profiles. Deleting the profile row therefore wipes
// the takedowns history alongside it. We accept this loss because GDPR
// erasure REQUIRES "all personal data" be removed — keeping a row that
// proves "this person existed and was deleted on this date" is exactly
// the kind of data GDPR forbids retaining without a separate lawful
// basis.
//
// We DO insert a final takedowns row before the delete so any reporting
// run mid-flight can see the action; that row is then cascaded out by
// the profile delete. If a stronger audit trail is needed later, the fix
// is at the schema layer (relax CASCADE on takedowns + null the profile_id
// FK on delete) — flag that to agent 1.

export interface GdprDeleteArgs {
  profile_id: string
  reason: string
}

export interface GdprDeleteResult {
  profile_id: string
  email_used: string | null
  bespoke_domain_released: string | null
  auth_user_deleted: boolean
}

export async function gdprDelete(args: GdprDeleteArgs): Promise<GdprDeleteResult> {
  if (!args.profile_id) throw new Error('gdprDelete: profile_id required')
  const sb = createAdminClient()

  const { data: profile, error: pErr } = await sb
    .from('profiles')
    .select('id, user_id, display_name, bespoke_domain')
    .eq('id', args.profile_id)
    .single()
  if (pErr) throw new Error(`gdprDelete(load): ${pErr.message}`)

  // Resolve auth email BEFORE deletion so we can confirm by email.
  let email: string | null = null
  if (profile.user_id) {
    const { data: ures } = await sb.auth.admin.getUserById(profile.user_id)
    email = ures.user?.email ?? null
  }

  // Insert the audit takedowns row first. This row will be cascaded out
  // when we delete the profile, but it gives a real-time observer the
  // signal that GDPR action is occurring.
  await sb.from('takedowns').insert({
    profile_id: args.profile_id,
    requested_by: 'gdpr',
    reason: args.reason,
  })

  // Photos: remove storage objects then DB rows. (DB rows would also go
  // via CASCADE on the profile delete, but storage bytes are NOT cascaded
  // — Supabase Storage is a separate service. Always remove storage first.)
  const { data: photoRows } = await sb
    .from('photos')
    .select('storage_path')
    .eq('profile_id', args.profile_id)
  const storagePaths = (photoRows ?? []).map((p) => p.storage_path).filter(Boolean)
  if (storagePaths.length) {
    const { error: stErr } = await sb.storage.from('photos').remove(storagePaths)
    if (stErr) {
       
      console.warn(`gdprDelete: storage partial: ${stErr.message}`)
    }
  }

  // Bespoke domain: detach from Vercel. Registrar lapse is fine.
  let releasedDomain: string | null = null
  if (profile.bespoke_domain) {
    try {
      await removeVercelDomain(profile.bespoke_domain)
      releasedDomain = profile.bespoke_domain
    } catch (e) {
       
      console.warn(`gdprDelete: vercel detach failed:`, e)
    }
  }

  // Send confirmation email BEFORE we delete the auth user (after that
  // we lose the address). Idempotency key is unique to GDPR so it can't
  // collide with a regular takedown email.
  if (email) {
    try {
      await sendEmail({
        to: email,
        email: renderTakedownFinal({ display_name: profile.display_name }),
        idempotencyKey: `gdpr-delete:${args.profile_id}`,
      })
    } catch (e) {
       
      console.warn(`gdprDelete: email failed:`, e)
    }
  }

  // Delete the profile row. CASCADE handles articles, photos, social_links,
  // takedowns, tc_acceptances; payments has ON DELETE SET NULL so it stays
  // (Stripe needs the audit trail and contains no personal data beyond a
  // customer id we can scrub by deleting the auth.users row).
  const { error: dErr } = await sb.from('profiles').delete().eq('id', args.profile_id)
  if (dErr) throw new Error(`gdprDelete(profile): ${dErr.message}`)

  // Delete auth user. Removes email, password hash, identities. supabase-js
  // returns 404 if already gone — treat as success.
  let authDeleted = false
  if (profile.user_id) {
    const { error: aErr } = await sb.auth.admin.deleteUser(profile.user_id)
    if (aErr && !`${aErr.message}`.toLowerCase().includes('not found')) {
      throw new Error(`gdprDelete(auth.users): ${aErr.message}`)
    }
    authDeleted = !aErr
  }

  return {
    profile_id: args.profile_id,
    email_used: email,
    bespoke_domain_released: releasedDomain,
    auth_user_deleted: authDeleted,
  }
}
