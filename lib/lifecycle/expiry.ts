import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/client'
import { renderExpiryWarning } from '@/lib/email/templates/expiry-warning'
import type { LifecycleProfileRow } from './types'

// Expiry detection. Two queries the cron route runs every morning:
//
//   findExpiredLive()        — already past expires_at, status still 'live'.
//                              Cron fires Events.EXPIRY_DUE for each so the
//                              Inngest handler can transition them.
//
//   findExpiringWithinDays() — expires within N days, status 'live', and we
//                              haven't already mailed them. Cron sends the
//                              warning email and stamps expiry_warning_sent_at.
//
// Both queries are cheap thanks to the profiles_expires_at_idx in 0004.
// We pull `auth.users.email` by going through the user_id; for users that
// have been deleted (user_id is null) we silently skip — there's nothing to
// warn.

export const DEFAULT_WARNING_DAYS = 7

export interface ExpiringProfile {
  profile_id: string
  user_id: string | null
  display_name: string
  expires_at: string
  email: string | null
}

export async function findExpiredLive(): Promise<ExpiringProfile[]> {
  const sb = createAdminClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await sb
    .from('profiles')
    .select('id, user_id, display_name, expires_at')
    .eq('status', 'live')
    .lte('expires_at', nowIso)
  if (error) throw new Error(`findExpiredLive: ${error.message}`)
  return (data ?? []).map((row) => ({
    profile_id: row.id,
    user_id: row.user_id,
    display_name: row.display_name,
    expires_at: row.expires_at as string,
    email: null,
  }))
}

export async function findExpiringWithinDays(
  days: number = DEFAULT_WARNING_DAYS,
): Promise<ExpiringProfile[]> {
  const sb = createAdminClient()
  const nowIso = new Date().toISOString()
  const horizonIso = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await sb
    .from('profiles')
    .select('id, user_id, display_name, expires_at, expiry_warning_sent_at')
    .eq('status', 'live')
    .gt('expires_at', nowIso)
    .lte('expires_at', horizonIso)
    .is('expiry_warning_sent_at', null)
  if (error) throw new Error(`findExpiringWithinDays: ${error.message}`)
  const rows = (data ?? []) as Array<
    Pick<LifecycleProfileRow, 'id' | 'user_id' | 'display_name' | 'expires_at' | 'expiry_warning_sent_at'>
  >
  // Hydrate emails. We do one auth lookup per row — N is small (a few per
  // day at most given the 7-day warning window).
  const out: ExpiringProfile[] = []
  for (const row of rows) {
    let email: string | null = null
    if (row.user_id) {
      const { data: ures } = await sb.auth.admin.getUserById(row.user_id)
      email = ures.user?.email ?? null
    }
    out.push({
      profile_id: row.id,
      user_id: row.user_id,
      display_name: row.display_name,
      expires_at: row.expires_at as string,
      email,
    })
  }
  return out
}

// Send the 7-day warning and stamp the column. Idempotent: the WHERE clause
// in findExpiringWithinDays excludes anyone already stamped.
export async function sendExpiryWarning(p: ExpiringProfile): Promise<boolean> {
  if (!p.email) return false
  const email = renderExpiryWarning({
    display_name: p.display_name,
    expires_at: p.expires_at,
  })
  await sendEmail({
    to: p.email,
    email,
    idempotencyKey: `expiry-warning:${p.profile_id}`,
  })
  const sb = createAdminClient()
  const { error } = await sb
    .from('profiles')
    .update({ expiry_warning_sent_at: new Date().toISOString() } as never)
    .eq('id', p.profile_id)
  if (error) throw new Error(`stamp expiry_warning_sent_at: ${error.message}`)
  return true
}
