import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { profileUrls } from '@/lib/contracts/revalidation'
import { registerBespokeDomain } from '@/lib/porkbun/register'

// Admin-only manual register endpoint. Use case: the BESPOKE_DOMAIN_REQUESTED
// Inngest workflow failed terminally (Porkbun rejected the registration,
// Vercel returned an error we couldn't recover from), the customer was
// refunded, and the customer service agent is retrying with a different
// domain or after the upstream issue is fixed.
//
// Body: { profile_id: uuid, domain: string }
//   - profile_id is required (we need to know which subdomain to redirect to)
//   - domain is the apex (e.g. "sarahchen.xyz") — not validated against the
//     cheap-TLD list, since admins might be doing a bespoke purchase the
//     normal flow wouldn't allow.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({
  profile_id: z.string().uuid(),
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, {
      message: 'must be a valid lower-case domain',
    }),
})

export async function POST(request: Request) {
  await requireAdmin()
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse((await request.json()) as unknown)
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, subdomain')
    .eq('id', parsed.profile_id)
    .single()
  if (error || !profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }
  const { personalHost } = profileUrls(profile)
  try {
    const result = await registerBespokeDomain({
      domain: parsed.domain,
      redirectTo: personalHost,
    })
    await sb
      .from('profiles')
      .update({ bespoke_domain: parsed.domain })
      .eq('id', parsed.profile_id)
    return NextResponse.json(result)
  } catch (e) {
     
    console.error(`porkbun/register failed for ${parsed.domain}:`, e)
    return NextResponse.json(
      { error: 'register_failed', message: (e as Error).message ?? 'unknown' },
      { status: 502 },
    )
  }
}
