import { NextResponse } from 'next/server'
import { findCooledTakedowns, finalizeTakedown } from '@/lib/lifecycle/takedown'
import { verifyCronAuth } from '@/lib/lifecycle/cron-auth'

// Daily takedown finalization cron. After TAKEDOWN_COOLING_DAYS (default
// 30) elapses for a profile in 'taken_down' status, this hard-deletes
// photos, social_links, articles, releases any bespoke domain, and
// anonymizes the profile row. The customer has had a full month to
// recover — we don't sit on PII forever.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const cooled = await findCooledTakedowns()
  let finalized_count = 0
  const errors: Array<{ profile_id: string; error: string }> = []
  for (const c of cooled) {
    try {
      await finalizeTakedown(c.profile_id)
      finalized_count++
    } catch (e) {
      errors.push({
        profile_id: c.profile_id,
        error: (e as Error).message ?? 'unknown',
      })
    }
  }
  return NextResponse.json({
    finalized_count,
    candidates: cooled.length,
    errors,
  })
}

export const POST = GET
