import 'server-only'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendBespokeDomainRequested,
  sendSignupPaid,
  sendTakedownRequested,
} from '@/lib/inngest/client'
import { devLog, devLogOnly } from '@/lib/inngest/dev'

// POST /api/stripe/webhook
//
// Verifies the Stripe signature, parses the event, and fans out to Inngest.
// Returns 200 immediately — all real work (publish pipeline, takedown) runs
// async in Inngest functions.

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const raw = await req.text()

  if (devLogOnly('stripe')) {
    devLog('stripe', 'webhook (dev-mode bypass — signature unchecked)', {
      preview: raw.slice(0, 200),
    })
  } else if (!sig || !secret) {
    return NextResponse.json({ error: 'signature missing' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    if (devLogOnly('stripe')) {
      event = JSON.parse(raw) as Stripe.Event
    } else {
      const stripe = getStripe()
      event = stripe.webhooks.constructEvent(raw, sig as string, secret as string)
    }
  } catch (err) {
    return NextResponse.json(
      { error: `bad signature: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const meta = (session.metadata ?? {}) as Record<string, string>
      const tier = meta.tier === 'bespoke_domain' ? 'bespoke_domain' : 'base'

      // Update payments row with the resolved amounts + status.
      await admin
        .from('payments')
        .update({
          amount_cents: session.amount_total ?? 0,
          currency: (session.currency ?? 'usd').toLowerCase(),
          stripe_customer_id:
            typeof session.customer === 'string' ? session.customer : null,
          stripe_subscription_id:
            typeof session.subscription === 'string' ? session.subscription : null,
          status: 'paid',
        })
        .eq('stripe_session_id', session.id)

      const profileId = meta.profile_id
      const userId = meta.user_id

      if (tier === 'base') {
        if (!profileId || !userId) {
          return NextResponse.json(
            { error: 'metadata missing profile_id/user_id' },
            { status: 200 },
          )
        }
        // The payments row id is what the contract calls payment_id.
        const { data: paymentRow } = await admin
          .from('payments')
          .select('id')
          .eq('stripe_session_id', session.id)
          .single()
        await sendSignupPaid({
          profile_id: profileId,
          user_id: userId,
          payment_id: paymentRow?.id ?? '',
          stripe_session_id: session.id,
        })
      } else {
        // bespoke_domain — fire to agent 7's listener. We may not have the
        // chosen domain in metadata at this point depending on how agent 2
        // collects it; if absent, leave it blank for agent 7 to look up.
        const domain = meta.domain ?? ''
        const { data: paymentRow } = await admin
          .from('payments')
          .select('id')
          .eq('stripe_session_id', session.id)
          .single()
        if (profileId) {
          await sendBespokeDomainRequested({
            profile_id: profileId,
            domain,
            payment_id: paymentRow?.id ?? '',
          })
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      if (!customerId) break
      // Find the profile via the most-recent payment for this customer.
      const { data: payment } = await admin
        .from('payments')
        .select('profile_id')
        .eq('stripe_customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (payment?.profile_id) {
        await sendTakedownRequested({
          profile_id: payment.profile_id,
          requested_by: 'customer',
          reason: 'subscription_cancelled',
        })
      }
      break
    }

    default:
      // Ignore everything else. Stripe sends a lot of events we don't care
      // about (payment_intent.succeeded, charge.updated, etc.).
      break
  }

  return NextResponse.json({ received: true })
}
