import { inngest } from '@/lib/inngest/client'
import { Events } from '@/lib/contracts/events'
import { createAdminClient } from '@/lib/supabase/admin'

// Handler for Events.EXPIRY_DUE. Fired by app/api/cron/expire/route.ts for
// every profile whose expires_at has passed. Job: flip status, drop a
// takedowns audit row, then re-emit Events.TAKEDOWN_REQUESTED so agent 6's
// listener handles email + revalidation, and our own takedown-finalize
// listener does lifecycle bookkeeping (cooling-period scheduling).
//
// Intentionally light. The destructive work happens 30 days later in the
// daily takedown cron — see lib/lifecycle/takedown.ts.

export const expiryDue = inngest.createFunction(
  { id: 'expiry-due', name: 'Expire profile and trigger takedown' },
  { event: Events.EXPIRY_DUE },
  async ({ event, step }) => {
    const profile_id = event.data.profile_id

    const profile = await step.run('fetch', async () => {
      const sb = createAdminClient()
      const { data, error } = await sb
        .from('profiles')
        .select('id, status')
        .eq('id', profile_id)
        .single()
      if (error) throw new Error(`expiry-due fetch: ${error.message}`)
      return data
    })

    // No-op if the profile already moved (manual takedown, GDPR, etc.).
    if (profile.status !== 'live') {
      return { profile_id, skipped: true, reason: `status=${profile.status}` }
    }

    await step.run('transition', async () => {
      const sb = createAdminClient()
      const { error: upErr } = await sb
        .from('profiles')
        .update({ status: 'taken_down' })
        .eq('id', profile_id)
        .eq('status', 'live') // optimistic guard: don't clobber a concurrent change
      if (upErr) throw new Error(`expiry-due transition: ${upErr.message}`)
      const { error: tdErr } = await sb.from('takedowns').insert({
        profile_id,
        requested_by: 'expiry',
        reason: 'Profile expired',
      })
      if (tdErr) throw new Error(`expiry-due takedowns: ${tdErr.message}`)
    })

    await step.sendEvent('fire-takedown', {
      name: Events.TAKEDOWN_REQUESTED,
      data: { profile_id, requested_by: 'expiry', reason: 'Profile expired' },
    })

    return { profile_id, skipped: false }
  },
)
