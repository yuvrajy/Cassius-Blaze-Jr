import { NextResponse } from 'next/server'

// Stub. Sub-agent 7 (lifecycle & domains) will process queued takedowns:
// for each profile with status = 'taken_down' that still has live storage
// objects or DNS records, run the cleanup steps and emit a takedowns
// audit row. Auth via CRON_SECRET.
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
