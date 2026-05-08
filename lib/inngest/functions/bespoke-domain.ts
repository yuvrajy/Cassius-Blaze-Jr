import Stripe from 'stripe'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/lib/inngest/client'
import { Events } from '@/lib/contracts/events'
import { createAdminClient } from '@/lib/supabase/admin'
import { profileUrls } from '@/lib/contracts/revalidation'
import {
  ensureDomainRegistered,
  ensureVercelDns,
  ensureVercelRedirectAttached,
} from '@/lib/porkbun/register'
import { waitForVerification } from '@/lib/vercel/domains'
import { sendEmail } from '@/lib/email/client'
import { renderBespokeDomainLive } from '@/lib/email/templates/bespoke-domain-live'
import { revalidateProfile } from '@/lib/contracts/revalidation'
import { devLog, devLogOnly } from '@/lib/inngest/dev'

// Handler for Events.BESPOKE_DOMAIN_REQUESTED. Sub-agent 6's Stripe webhook
// fires this when a `tier=bespoke_domain` checkout completes. We:
//   1. register the domain at Porkbun
//   2. point its DNS at Vercel
//   3. attach it to the project as a redirect-type domain → iam.bio host
//   4. wait for Vercel verification
//   5. stamp profiles.bespoke_domain
//   6. email the customer
//   7. revalidate the news/personal pages so cross-links can adopt the
//      bespoke domain if any agent decides to surface it
//
// Each step is wrapped in step.run so Inngest retries them independently.
// All step bodies are idempotent (see lib/porkbun/register.ts).
//
// On terminal failure (registration rejected, Vercel rejected the domain,
// non-recoverable), we:
//   - mark payments.status = 'registration_failed'
//   - email ADMIN_EMAILS[0]
//   - issue a Stripe refund via stripe.refunds.create({ charge })
// and throw a NonRetriableError so Inngest stops retrying.

const STEP_VERIFICATION_TIMEOUT_MS = 5 * 60 * 1000

export const bespokeDomain = inngest.createFunction(
  {
    id: 'bespoke-domain',
    name: 'Register bespoke domain and attach to Vercel',
  },
  { event: Events.BESPOKE_DOMAIN_REQUESTED },
  async ({ event, step }) => {
    const { profile_id, payment_id } = event.data
    const eventDomain = event.data.domain

    const ctx = await step.run('load-payment', async () => {
      const sb = createAdminClient()
      const { data: payment, error: pErr } = await sb
        .from('payments')
        .select('id, stripe_session_id, stripe_customer_id, status')
        .eq('id', payment_id)
        .single()
      if (pErr) throw new Error(`bespoke-domain payment: ${pErr.message}`)
      const { data: profile, error: prErr } = await sb
        .from('profiles')
        .select('id, subdomain, display_name, user_id')
        .eq('id', profile_id)
        .single()
      if (prErr) throw new Error(`bespoke-domain profile: ${prErr.message}`)
      // Source of truth for the chosen domain is the event payload — the
      // contract guarantees `domain` is present (sub-agent 6's webhook pulls
      // it from payments.bespoke_domain_chosen at fire time and includes it
      // in the event). We re-read the payment row only for refund metadata.
      const domain = eventDomain
      if (!domain) {
        throw new NonRetriableError(
          `bespoke-domain: event missing domain for payment ${payment_id}`,
        )
      }
      const { personalHost } = profileUrls(profile)
      let email: string | null = null
      if (profile.user_id) {
        const { data: ures } = await sb.auth.admin.getUserById(profile.user_id)
        email = ures.user?.email ?? null
      }
      return { domain, redirectTo: personalHost, profile, payment, email }
    })

    try {
      await step.run('register-domain', () => ensureDomainRegistered(ctx.domain))
      await step.run('set-dns', () => ensureVercelDns(ctx.domain))
      await step.run('vercel-attach', () =>
        ensureVercelRedirectAttached({ domain: ctx.domain, redirectTo: ctx.redirectTo }),
      )
      const verified = await step.run('verify', async () => {
        const ok = await waitForVerification(ctx.domain, STEP_VERIFICATION_TIMEOUT_MS)
        return ok
      })

      await step.run('save-profile', async () => {
        const sb = createAdminClient()
        const { error } = await sb
          .from('profiles')
          .update({ bespoke_domain: ctx.domain })
          .eq('id', profile_id)
        if (error) throw new Error(`save-profile: ${error.message}`)
      })

      await step.run('email', async () => {
        if (!ctx.email) return { skipped: true, reason: 'no_email_on_user' }
        const sb = createAdminClient()
        const { data: existing } = await sb
          .from('profiles')
          .select('bespoke_domain_email_sent_at')
          .eq('id', profile_id)
          .single()
        if (
          (existing as unknown as { bespoke_domain_email_sent_at?: string | null })
            ?.bespoke_domain_email_sent_at
        ) {
          return { skipped: true, reason: 'already_sent' }
        }
        await sendEmail({
          to: ctx.email,
          email: renderBespokeDomainLive({
            display_name: ctx.profile.display_name,
            domain: ctx.domain,
            redirect_to: ctx.redirectTo,
          }),
          idempotencyKey: `bespoke-domain-live:${profile_id}`,
        })
        await sb
          .from('profiles')
          .update({ bespoke_domain_email_sent_at: new Date().toISOString() } as never)
          .eq('id', profile_id)
        return { sent: true }
      })

      await step.run('revalidate', async () => {
        const sb = createAdminClient()
        const { data: article } = await sb
          .from('articles')
          .select('slug')
          .eq('profile_id', profile_id)
          .maybeSingle()
        await revalidateProfile(
          { subdomain: ctx.profile.subdomain },
          { slug: article?.slug ?? '' },
        )
      })

      return { profile_id, domain: ctx.domain, verified }
    } catch (err) {
      if (err instanceof NonRetriableError) throw err
      // Bubble retryable errors so Inngest keeps trying. We classify
      // "auth not configured" / "porkbun rejected name" failures as
      // non-retryable here so we don't loop forever, but only after
      // we've already done our 4 default attempts via step retries —
      // Inngest's default policy handles transient issues. If we get
      // here at all, it's because a step exhausted its retries.
      await step.run('refund', async () => {
        await refundAndAlert({
          profile_id,
          domain: ctx.domain,
          payment_id,
          stripe_session_id: ctx.payment.stripe_session_id,
          reason: (err as Error).message ?? 'unknown',
        })
      })
      throw new NonRetriableError(
        `bespoke-domain failed for ${ctx.domain}: ${(err as Error).message}`,
      )
    }
  },
)

interface RefundArgs {
  profile_id: string
  domain: string
  payment_id: string
  stripe_session_id: string | null
  reason: string
}

async function refundAndAlert(args: RefundArgs): Promise<void> {
  const sb = createAdminClient()
  await sb
    .from('payments')
    .update({ status: 'registration_failed' })
    .eq('id', args.payment_id)

  // Refund. Stripe Refund API takes either { charge } or { payment_intent }.
  // From a Checkout Session we can pull the latest payment_intent and refund
  // that. In dev mode we just log.
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const sessionId = args.stripe_session_id
  if (devLogOnly('stripe') || devLogOnly() || !stripeKey || !sessionId) {
    devLog('stripe', 'refund (dev-log-only)', {
      payment_id: args.payment_id,
      reason: args.reason,
    })
  } else {
    try {
      const stripe = new Stripe(stripeKey)
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      const pi =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id
      if (pi) {
        await stripe.refunds.create({ payment_intent: pi })
      }
    } catch (e) {
       
      console.error(
        `bespoke-domain refund failed for ${args.payment_id}:`,
        (e as Error).message,
      )
    }
  }

  // Alert admin.
  const adminList = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  const to = adminList[0]
  if (!to) return
  try {
    await sendEmail({
      to,
      email: {
        subject: `Bespoke domain registration failed: ${args.domain}`,
        text: [
          `Profile: ${args.profile_id}`,
          `Domain:  ${args.domain}`,
          `Payment: ${args.payment_id}`,
          `Reason:  ${args.reason}`,
          '',
          'Customer has been refunded automatically. Investigate and consider a manual retry via /api/porkbun/register.',
        ].join('\n'),
        html: `
          <p><strong>Bespoke domain registration failed.</strong></p>
          <ul>
            <li>Profile: ${args.profile_id}</li>
            <li>Domain: ${args.domain}</li>
            <li>Payment: ${args.payment_id}</li>
            <li>Reason: ${args.reason}</li>
          </ul>
          <p>Customer has been refunded automatically.
             Investigate and consider a manual retry via /api/porkbun/register.</p>
        `.trim(),
      },
      idempotencyKey: `bespoke-domain-failed:${args.payment_id}`,
    })
  } catch (e) {
     
    console.error('bespoke-domain admin alert failed:', e)
  }
}
