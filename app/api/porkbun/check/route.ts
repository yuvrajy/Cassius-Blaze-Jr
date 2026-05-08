import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { InvalidNameError, searchAvailable } from '@/lib/porkbun/check'

// Domain availability search for the bespoke-domain upsell. Logged-in
// users only — there's no public-facing reason for an anon visitor to
// burn our Porkbun rate limits.
//
// Body: { name: string }   e.g. "sarah-chen"
// Returns: { name, options: [{ domain, tld, first_year_usd, renewal_usd }, ...] }
//
// Implementation note: searchAvailable iterates the curated cheap-TLD list
// in parallel with per-call timeouts. A single flaky TLD doesn't kill the
// search — it just doesn't show up in the result.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({ name: z.string().min(1).max(100) })

export async function POST(request: Request) {
  // Will redirect to /login for an anon caller.
  await requireUser()

  let parsed: z.infer<typeof Body>
  try {
    const json = (await request.json()) as unknown
    parsed = Body.parse(json)
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  try {
    const options = await searchAvailable(parsed.name)
    return NextResponse.json({ name: parsed.name, options })
  } catch (e) {
    if (e instanceof InvalidNameError) {
      return NextResponse.json({ error: 'invalid_name', message: e.message }, { status: 400 })
    }
     
    console.warn(`porkbun/check failed for "${parsed.name}":`, e)
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
  }
}
