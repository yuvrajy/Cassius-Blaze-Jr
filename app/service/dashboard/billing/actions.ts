'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// Open the Stripe customer portal in the user's browser. Implemented
// against Stripe's REST API directly (form-urlencoded) instead of the
// stripe SDK because the SDK isn't installed at the repo root yet —
// agent 6 may swap to the SDK later. The portal handles every renewal /
// cancellation / payment-method screen so we don't have to.
export async function openBillingPortal(): Promise<void> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment?.stripe_customer_id) {
    redirect('/dashboard/billing?error=no_customer')
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    console.error('[billing] STRIPE_SECRET_KEY missing')
    redirect('/dashboard/billing?error=stripe_not_configured')
  }

  const serviceDomain = process.env.NEXT_PUBLIC_SERVICE_DOMAIN ?? 'getknown.com'
  const returnUrl = `https://${serviceDomain}/dashboard/billing`

  const body = new URLSearchParams({
    customer: payment.stripe_customer_id,
    return_url: returnUrl,
  })

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[billing] stripe portal session failed', res.status, text)
    redirect('/dashboard/billing?error=stripe_failed')
  }
  const session = (await res.json()) as { url?: string }
  if (!session.url) redirect('/dashboard/billing?error=stripe_no_url')
  redirect(session.url)
}
