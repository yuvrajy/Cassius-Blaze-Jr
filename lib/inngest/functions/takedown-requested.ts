import 'server-only'
import { inngest } from '@/lib/inngest/client'
import {
  Events,
  type TakedownRequestedPayload,
} from '@/lib/contracts/events'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidateProfile } from '@/lib/contracts/revalidation'
import { sendEmail } from '@/lib/email/client'
import { takedownConfirmEmail } from '@/lib/email/templates/takedown-confirm'

// takedown.requested → status flip + audit log + email + revalidate.
//
// Scope split with agent 7 (cron / lifecycle):
//   - We:    flip profile.status='taken_down', flip article.status='taken_down',
//            insert takedowns audit row, send confirmation email, revalidate.
//   - Agent 7: domain release (Porkbun), Vercel domain detach, deep
//              deindex via 410 / sitemap removal, GDPR retention timer.

export const takedownRequested = inngest.createFunction(
  {
    id: 'takedown-requested',
    name: 'Take down a profile',
    retries: 3,
  },
  { event: Events.TAKEDOWN_REQUESTED },
  async ({ event, step }) => {
    const { profile_id, requested_by, reason } = event.data as TakedownRequestedPayload
    const admin = createAdminClient()

    const profile = await step.run('load-profile', async () => {
      const { data, error } = await admin
        .from('profiles')
        .select('id, subdomain, display_name, user_id, status, articles(slug)')
        .eq('id', profile_id)
        .single()
      if (error || !data) throw new Error(`profile ${profile_id}: ${error?.message ?? 'missing'}`)
      return data as typeof data & { articles: { slug: string }[] }
    })

    await step.run('flip-status', async () => {
      // Idempotent: if already taken_down, no-op.
      if (profile.status === 'taken_down') return
      const { error: pErr } = await admin
        .from('profiles')
        .update({ status: 'taken_down' })
        .eq('id', profile_id)
      if (pErr) throw new Error(`profile status: ${pErr.message}`)
      const { error: aErr } = await admin
        .from('articles')
        .update({ status: 'taken_down' })
        .eq('profile_id', profile_id)
      if (aErr) throw new Error(`article status: ${aErr.message}`)
    })

    await step.run('audit-row', async () => {
      // Insert one audit row per takedown request. Repeated events for the
      // same reason are recorded — the requested_by + created_at combo is
      // the de-facto idempotency surface here.
      const { error } = await admin.from('takedowns').insert({
        profile_id,
        requested_by,
        reason: reason ?? null,
      })
      if (error) throw new Error(`takedowns insert: ${error.message}`)
    })

    await step.run('send-confirm-email', async () => {
      const userId = profile.user_id
      if (!userId) return
      const { data: u } = await admin.auth.admin.getUserById(userId)
      const email = u?.user?.email
      if (!email) return
      await sendEmail({
        to: email,
        email: takedownConfirmEmail({
          display_name: profile.display_name,
          reason,
        }),
        idempotencyKey: `takedown:${profile_id}`,
      })
    })

    await step.run('revalidate', async () => {
      const article = profile.articles?.[0]
      await revalidateProfile(
        { subdomain: profile.subdomain },
        { slug: article?.slug ?? `none-${profile_id}` },
      )
    })

    return { profile_id, requested_by }
  },
)
