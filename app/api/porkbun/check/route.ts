import { NextResponse } from 'next/server'

// Stub. Sub-agent 7 (lifecycle & domains) will:
//   - Accept a candidate domain in the query string
//   - Call Porkbun availability API with PORKBUN_API_KEY/SECRET
//   - Return { available: bool, price_cents?: number }
export function GET() {
  return NextResponse.json(
    { stub: true, owner: 'agent 7' },
    { status: 501 },
  )
}
