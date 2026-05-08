import { NextResponse } from 'next/server'

// Stub. Sub-agent 6 (workflows) will run admin-triggered moderation actions
// here: approve, reject, or request changes for a profile/article. Output
// shapes live in `lib/contracts/moderation.ts`.
export function POST() {
  return NextResponse.json(
    { stub: true, owner: 'agent 6' },
    { status: 501 },
  )
}
