import { NextResponse } from 'next/server'

// Stub. Sub-agent 6 (workflows) will mount the Inngest serve handler here:
//   import { serve } from 'inngest/next'
//   import { inngest } from '@/lib/inngest/client'
//   import * as fns from '@/lib/inngest/functions'
//   export const { GET, POST, PUT } = serve({ client: inngest, functions: [...] })
//
// Event names live in `lib/contracts/events.ts` and must match exactly.
export function GET() {
  return NextResponse.json(
    { stub: true, owner: 'agent 6' },
    { status: 501 },
  )
}
export function POST() {
  return NextResponse.json(
    { stub: true, owner: 'agent 6' },
    { status: 501 },
  )
}
