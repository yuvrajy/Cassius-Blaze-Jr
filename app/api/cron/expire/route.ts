import { NextResponse } from 'next/server'
import {
  DEFAULT_WARNING_DAYS,
  findExpiredLive,
  findExpiringWithinDays,
  sendExpiryWarning,
} from '@/lib/lifecycle/expiry'
import { sendExpiryDue } from '@/lib/inngest/client'
import { verifyCronAuth } from '@/lib/lifecycle/cron-auth'

// Daily expiry cron — Vercel Cron pings GET /api/cron/expire at the
// schedule in vercel.json (06:00 UTC). Authenticated by `CRON_SECRET`
// via the Authorization header (constant-time check in cron-auth).
//
// Two passes per run:
//   1. EXPIRED: profiles already past expires_at + still 'live'. Fire
//      Events.EXPIRY_DUE for each — agent 7's expiry-due Inngest handler
//      transitions them to taken_down and emits TAKEDOWN_REQUESTED.
//   2. WARNING: profiles expiring within 7 days (configurable env later
//      if we ever want it) that haven't been warned yet. Send the warning
//      email and stamp expiry_warning_sent_at.
//
// Run order matters slightly: we expire first so a customer who lets the
// date pass doesn't get a warning AND a takedown email on the same day.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const expired = await findExpiredLive()
  for (const p of expired) {
    await sendExpiryDue({ profile_id: p.profile_id })
  }
  const warnings = await findExpiringWithinDays(DEFAULT_WARNING_DAYS)
  let warnings_sent = 0
  for (const p of warnings) {
    try {
      const ok = await sendExpiryWarning(p)
      if (ok) warnings_sent++
    } catch (e) {
       
      console.warn(`expire-cron: warning failed for ${p.profile_id}:`, e)
    }
  }
  return NextResponse.json({
    expired_count: expired.length,
    warnings_sent,
    warnings_considered: warnings.length,
  })
}

// POST is also accepted so external schedulers that prefer POST can use it.
export const POST = GET
