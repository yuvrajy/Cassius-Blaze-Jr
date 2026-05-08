import { NextResponse } from 'next/server'

// Stub. Sub-agent 6 (workflows) will:
//   1. Validate body against `lib/contracts/signup.ts` SignupInput
//   2. Create the auth.users row + profiles row + tc_acceptances row
//   3. Create a Stripe Checkout session and return its URL
// Until then, return 501 so callers see this is unimplemented.
export function POST() {
  return NextResponse.json(
    { stub: true, owner: 'agent 6' },
    { status: 501 },
  )
}
