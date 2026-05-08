import { NextResponse } from 'next/server'

// Liveness probe. Returns 200 if the app process is up. Does NOT check the
// database, Stripe, or any other dependency — keep it cheap and unconditional.
export function GET() {
  return NextResponse.json({ ok: true })
}
