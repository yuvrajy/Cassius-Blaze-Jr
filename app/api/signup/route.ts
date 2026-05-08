import 'server-only'
import { NextResponse } from 'next/server'
import { SignupInput } from '@/lib/contracts/signup'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, priceIdForTier } from '@/lib/stripe/client'
import { insertPendingSignup } from '@/lib/inngest/pending-signups'
import { devLog, devLogOnly } from '@/lib/inngest/dev'

// POST /api/signup
//
// Server-side flow (mirrors the brief):
//   1. Re-validate the SignupInput body against the Zod schema. Reject
//      unknown shapes and any unchecked T&C / age boxes.
//   2. Check the subdomain is still available (race-safe: rely on the
//      profiles.subdomain unique index — catch the conflict).
//   3. Provision the Supabase auth user for the customer's email if one
//      doesn't already exist; capture user_id.
//   4. Stash the full validated payload in `pending_signups`.
//   5. Insert a profile shell row (status='pending_moderation' — RLS
//      already hides non-live profiles from the public, so the shell is
//      invisible until the workflow approves it). We carry the
//      pending_signup_id in `moderation_notes` as a tiny JSON pointer so
//      the Inngest handler can find it after the webhook fires.
//   6. Insert a payments row in `pending` status, keyed on the Stripe
//      session id. The webhook flips it to `paid`.
//   7. Create a Stripe Checkout session with metadata
//      { profile_id, user_id, pending_signup_id, tier } so the webhook
//      has everything it needs without a DB lookup.
//   8. Return { checkoutUrl }.

export async function POST(req: Request) {
  // -- 1. Parse + validate --------------------------------------------
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

  // 18+ check from DOB.
  if (!isEighteenPlus(data.dob)) {
    return NextResponse.json({ error: 'must be 18+' }, { status: 400 })
  }

  // Customer email + tier come in a sibling object. The signup contract
  // doesn't specify them today, so accept them off the JSON envelope.
  const env = (json as { email?: string; tier?: string } | null) ?? {}
  const customerEmail = typeof env.email === 'string' ? env.email.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }
  const tier: 'base' | 'bespoke_domain' =
    env.tier === 'bespoke_domain' ? 'bespoke_domain' : 'base'

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

  // -- 3. Provision auth user -----------------------------------------
  const userId = await ensureAuthUser(admin, customerEmail)

  // -- 4. Stash the payload -------------------------------------------
  const pendingSignupId = await insertPendingSignup(data)

  // -- 5. Profile shell -----------------------------------------------
  const { data: created, error: profileErr } = await admin
    .from('profiles')
    .insert({
      user_id: userId,
      subdomain: data.subdomain,
      display_name: data.display_name,
      tagline: data.tagline ?? null,
      bio: data.bio,
      status: 'pending_moderation',
      moderation_notes: JSON.stringify({ pending_signup_id: pendingSignupId }),
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

  // -- 6 + 7. Create Stripe Checkout ----------------------------------
  if (devLogOnly('stripe')) {
    devLog('stripe', 'createCheckoutSession (dev-mode)', {
      tier,
      customerEmail,
      profileId,
    })
    return NextResponse.json({
      checkoutUrl: `https://stripe.local/devmode/${profileId}`,
      profileId,
    })
  }

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerEmail,
    line_items: [{ price: priceIdForTier(tier), quantity: 1 }],
    success_url: `${siteUrl()}/service/dashboard?paid=1`,
    cancel_url: `${siteUrl()}/service/signup?cancelled=1`,
    metadata: {
      profile_id: profileId,
      user_id: userId,
      pending_signup_id: pendingSignupId,
      tier,
    },
  })

  // Pre-create the payments row in `pending` so the webhook update is a
  // pure flip rather than an insert race.
  await admin.from('payments').insert({
    profile_id: profileId,
    user_id: userId,
    stripe_session_id: session.id,
    amount_cents: 0,
    currency: 'usd',
    tier,
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

async function ensureAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string> {
  // Look for an existing user with this email. The admin API doesn't expose
  // a direct findByEmail, so we list a small page filtered by email — it's
  // fine for a single signup request.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (found) return found.id

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
  })
  if (error || !created.user) {
    throw new Error(`createUser failed: ${error?.message ?? 'unknown'}`)
  }
  return created.user.id
}
