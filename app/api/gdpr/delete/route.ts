import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { gdprDelete } from '@/lib/lifecycle/gdpr'

// Admin-gated GDPR right-to-be-forgotten endpoint.
//
// v1 is admin-mediated: the user emails support, ops verifies their identity
// out-of-band, then triggers this endpoint with the profile_id. This is
// intentionally simpler than building a self-serve verified-token flow now
// — the volume is too low to justify it, and the worst-case outcome of a
// self-serve flow is irreversible deletion of someone else's data, which
// we can't afford to get wrong.
//
// Body: { profile_id: uuid, reason: string }
// Effects (see lib/lifecycle/gdpr.ts):
//   - removes photos (storage + DB), social_links, articles, tc_acceptances
//   - releases any bespoke domain from Vercel
//   - deletes the profiles row (CASCADEs takedowns, etc.)
//   - deletes the auth.users row
//   - sends the customer a confirmation email

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({
  profile_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
})

export async function POST(request: Request) {
  await requireAdmin()
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse((await request.json()) as unknown)
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  try {
    const result = await gdprDelete({
      profile_id: parsed.profile_id,
      reason: parsed.reason,
    })
    return NextResponse.json(result)
  } catch (e) {
     
    console.error(`gdpr/delete failed for ${parsed.profile_id}:`, e)
    return NextResponse.json(
      { error: 'delete_failed', message: (e as Error).message ?? 'unknown' },
      { status: 500 },
    )
  }
}
