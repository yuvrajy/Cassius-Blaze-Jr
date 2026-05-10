import 'server-only'
import { NextResponse } from 'next/server'
import { SignupInput } from '@/lib/contracts/signup'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, priceIdForTier } from '@/lib/stripe/client'
import { insertPendingSignup } from '@/lib/inngest/pending-signups'
import { devLog, devLogOnly } from '@/lib/inngest/dev'

// POST /api/signup
//
// Server-side flow (mirrors lib/contracts/README.md "Auth lifecycle for signup"):
//   1. Re-validate the SignupInput body. user_id, email, tier, and
//      self_or_permission_attested are now first-class required fields.
//      The user_id was created at form mount via signInAnonymously() and
//      stays stable through to publish.
//   2. Check the subdomain is still available (race-safe via the unique
//      index — catch the conflict).
//   3. Stash the validated payload in `pending_signups`.
//   4. Insert a profile shell row bound to the anonymous user_id.
//   5. Pre-create a payments row in `pending` status (idempotent on
//      stripe_session_id once we have it).
//   6. Create a Stripe Checkout session with metadata
//      { profile_id, user_id, pending_signup_id, tier } so the webhook
//      passes pending_signup_id straight through onto the SIGNUP_PAID
//      event payload.
//   7. Return { checkoutUrl }.

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const parse = SignupInput.safeParse(json)
  if (!parse.success) {
    return NextResponse.json(
      { error: 'invalid signup payload', issues: parse.error.issues },
      { status: 400 },
    )
  }
  const data = parse.data

  if (!isEighteenPlus(data.dob)) {
    return NextResponse.json({ error: 'must be 18+' }, { status: 400 })
  }

  const admin = createAdminClient()

  // -- 2. Subdomain still available? ----------------------------------
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('subdomain', data.subdomain)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'subdomain taken' }, { status: 409 })
  }

  // -- 3. Stash the payload -------------------------------------------
  const pendingSignupId = await insertPendingSignup(data)

  // -- 4. Profile shell -----------------------------------------------
  const { data: created, error: profileErr } = await admin
    .from('profiles')
    .insert({
      user_id: data.user_id,
      subdomain: data.subdomain,
      display_name: data.display_name,
      tagline: data.tagline ?? null,
      bio: data.bio,
      status: 'pending_moderation',
    })
    .select('id')
    .single()
  if (profileErr || !created) {
    if (profileErr?.message?.toLowerCase().includes('subdomain')) {
      return NextResponse.json({ error: 'subdomain taken' }, { status: 409 })
    }
    return NextResponse.json(
      { error: `profile insert failed: ${profileErr?.message}` },
      { status: 500 },
    )
  }
  const profileId = created.id

  // -- 5 + 6. Create Stripe Checkout ----------------------------------
  if (devLogOnly('stripe')) {
    devLog('stripe', 'createCheckoutSession (dev-mode)', {
      tier: data.tier,
      email: data.email,
      profileId,
      userId: data.user_id,
      pendingSignupId,
    })
    return NextResponse.json({
      checkoutUrl: `https://stripe.local/devmode/${profileId}`,
      profileId,
    })
  }

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: data.email,
    line_items: [{ price: priceIdForTier(data.tier), quantity: 1 }],
    success_url: `${siteUrl()}/service/dashboard?paid=1`,
    cancel_url: `${siteUrl()}/service/signup?cancelled=1`,
    metadata: {
      profile_id: profileId,
      user_id: data.user_id,
      pending_signup_id: pendingSignupId,
      tier: data.tier,
    },
  })

  await admin.from('payments').insert({
    profile_id: profileId,
    user_id: data.user_id,
    stripe_session_id: session.id,
    amount_cents: 0,
    currency: 'usd',
    tier: data.tier,
    status: 'pending',
  })

  return NextResponse.json({ checkoutUrl: session.url, profileId })
}

function siteUrl(): string {
  const host = process.env.NEXT_PUBLIC_SERVICE_DOMAIN ?? 'getknown.com'
  return `https://${host}`
}

function isEighteenPlus(isoDate: string): boolean {
  const dob = Date.parse(isoDate)
  if (Number.isNaN(dob)) return false
  const yrs = (Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000)
  return yrs >= 18
}
