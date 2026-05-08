import { inngest } from '@/lib/inngest/client'
import { Events } from '@/lib/contracts/events'
import { createAdminClient } from '@/lib/supabase/admin'

// Sub-agent 7's listener on Events.TAKEDOWN_REQUESTED. Sub-agent 6 also
// listens for the same event — there is no name collision because Inngest
// dispatches one event to every function whose `event` field matches.
//
// Separation of concerns:
//   - sub-agent 6's takedown-requested:  flip profile + article status,
//                                        send "we removed it" email,
//                                        revalidate paths.
//   - sub-agent 7 (this function):       lifecycle finalization concerns.
//                                        Mostly: record the moment so the
//                                        daily cron knows when the cooling
//                                        period started; flag any side
//                                        effects (bespoke domain release)
//                                        for follow-up.
//
// We do NOT hard-delete here. The daily takedown cron does it after the
// cooling period (default 30 days). This handler intentionally fans out
// metadata and leaves the heavy work for a scheduled batch.

export const takedownFinalize = inngest.createFunction(
  {
    id: 'takedown-finalize',
    name: 'Schedule takedown finalization (cooling period)',
  },
  { event: Events.TAKEDOWN_REQUESTED },
  async ({ event, step }) => {
    const { profile_id } = event.data

    const profile = await step.run('load-profile', async () => {
      const sb = createAdminClient()
      const { data, error } = await sb
        .from('profiles')
        .select('id, bespoke_domain')
        .eq('id', profile_id)
        .maybeSingle()
      if (error) throw new Error(`takedown-finalize load: ${error.message}`)
      return data
    })

    if (!profile) {
      return { profile_id, skipped: true, reason: 'profile_not_found' }
    }

    await step.run('schedule-deindex', async () => {
      // We don't programmatically submit URL removals to Google Search
      // Console — the API is brittle and partial. Manual ops in v1.
      // Documented as a known TODO; see brief.
       
      console.info(
        `takedown-finalize: TODO submit Search Console URL removals for ${profile_id}`,
      )
      return { todo: 'gsc_url_removal' }
    })

    await step.run('log-takedown', async () => {
      // The daily cron uses the takedowns row's created_at as the cooling-
      // period anchor. We don't need to insert another row here — sub-agent 6
      // (or our expiry-due handler) already inserted one when the takedown
      // was requested. Just log that we've seen the event.
      return { profile_id, bespoke_domain: profile.bespoke_domain ?? null }
    })

    return { profile_id, scheduled: true }
  },
)
