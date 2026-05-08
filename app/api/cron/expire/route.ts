import { NextResponse } from 'next/server'

// Stub. Sub-agent 7 (lifecycle & domains) will:
//   1. Verify the request carries `Authorization: Bearer ${CRON_SECRET}`
//   2. Find all profiles with expires_at <= now() and status = 'live'
//   3. Fire Events.EXPIRY_DUE for each → moves them to taken_down
export function GET() {
  return NextResponse.json(
    { stub: true, owner: 'agent 7' },
    { status: 501 },
  )
}
export function POST() {
  return NextResponse.json(
    { stub: true, owner: 'agent 7' },
    { status: 501 },
  )
}
