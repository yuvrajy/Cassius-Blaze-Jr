import { NextResponse } from 'next/server'

// Stub. Sub-agent 6 (workflows) will:
//   1. Verify the Stripe signature using STRIPE_WEBHOOK_SECRET
//   2. On checkout.session.completed for tier=base → fire Events.SIGNUP_PAID
//   3. On checkout.session.completed for tier=bespoke_domain →
//      fire Events.BESPOKE_DOMAIN_REQUESTED
//   4. Persist the payment row
export function POST() {
  return NextResponse.json(
    { stub: true, owner: 'agent 6' },
    { status: 501 },
  )
}
