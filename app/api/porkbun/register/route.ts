import { NextResponse } from 'next/server'

// Stub. Sub-agent 7 (lifecycle & domains) will:
//   - Buy the domain via Porkbun (after BESPOKE_DOMAIN_REQUESTED fires)
//   - Configure DNS to 301 → {subdomain}.iam.bio
//   - Store the resulting domain on profiles.bespoke_domain
export function POST() {
  return NextResponse.json(
    { stub: true, owner: 'agent 7' },
    { status: 501 },
  )
}
