import 'server-only'
import { inngest } from '@/lib/inngest/client'
import {
  Events,
  type ProfileUpdatedPayload,
} from '@/lib/contracts/events'
import { createAdminClient } from '@/lib/supabase/admin'
import { moderateBio } from '@/lib/moderation/bio'
import { moderatePhoto } from '@/lib/moderation/photo'
import { generateArticle } from '@/lib/moderation/article'
import { revalidateProfile } from '@/lib/contracts/revalidation'
import { sendEmail } from '@/lib/email/client'
import { reModerationEmail } from '@/lib/email/templates/re-moderation'
import type { PhotoRow } from '@/lib/types/db'

// profile.updated → re-run the relevant moderation steps and revalidate.
//
// CONTRACT NOTE: The brief described this event as having an `action`
// discriminator (approved | rejected | bio_changed | photo_added). The
// frozen contract instead carries `changed_fields[]`. We branch on
// `changed_fields` here. Approve / reject decisions go through the admin
// /api/moderate endpoint and update the DB directly — they don't ride this
// event. See the handoff summary for the gap.

export const profileUpdated = inngest.createFunction(
  {
    id: 'profile-updated',
    name: 'Re-moderate after owner edit',
    retries: 3,
  },
  { event: Events.PROFILE_UPDATED },
  async ({ event, step }) => {
    const { profile_id, changed_fields } = event.data as ProfileUpdatedPayload
    const admin = createAdminClient()

    // ---- Load the profile + photos ----------------------------------
    const profile = await step.run('load-profile', async () => {
      const { data, error } = await admin
        .from('profiles')
        .select('*, photos(*), articles(*)')
        .eq('id', profile_id)
        .single()
      if (error || !data) throw new Error(`profile ${profile_id}: ${error?.message ?? 'missing'}`)
      return data as typeof data & {
        photos: PhotoRow[]
        articles: { id: string; slug: string }[]
      }
    })

    const bioChanged = changed_fields.includes('bio')
    const photosChanged = changed_fields.includes('photos')

    // ---- Bio re-moderation + article regen --------------------------
    if (bioChanged) {
      const verdict = await step.run('re-moderate-bio', () => moderateBio(profile.bio))
      const article = await step.run('regenerate-article', () =>
        generateArticle({
          display_name: profile.display_name,
          tagline: profile.tagline,
          bio: profile.bio,
          social_links: [], // refetched below if you want richer prompt
        }),
      )
      await step.run('apply-bio-results', async () => {
        const existing = profile.articles?.[0]
        if (existing) {
          const { error: aErr } = await admin
            .from('articles')
            .update({
              headline: article.headline,
              subheadline: article.subheadline,
              body: article.body,
              status: 'pending_moderation',
            })
            .eq('id', existing.id)
          if (aErr) throw new Error(`article update: ${aErr.message}`)
        }
        const { error: pErr } = await admin
          .from('profiles')
          .update({
            status: 'pending_moderation',
            moderation_notes: JSON.stringify({ bio: verdict, at: new Date().toISOString() }),
          })
          .eq('id', profile_id)
        if (pErr) throw new Error(`profile status: ${pErr.message}`)
      })

      await step.run('send-remod-email', async () => {
        const { data: u } = await admin.auth.admin.getUserById(
          profile.user_id ?? '',
        )
        const email = u?.user?.email
        if (!email) return
        await sendEmail({
          to: email,
          email: reModerationEmail({ display_name: profile.display_name }),
          idempotencyKey: `remod:${profile_id}:${Date.now() / 60_000 | 0}`,
        })
      })
    }

    // ---- Photo re-moderation (no auto-status flip) ------------------
    if (photosChanged) {
      await step.run('re-moderate-photos', async () => {
        const verdicts = []
        for (const photo of profile.photos ?? []) {
          const url =
            photo.variants?.large ?? photo.variants?.original ?? photo.storage_path
          if (!url) continue
          verdicts.push(await moderatePhoto({ photoId: photo.id, url }))
        }
        // Append to moderation_notes; preserve any existing JSON blob.
        let prior: Record<string, unknown> = {}
        try {
          if (profile.moderation_notes) prior = JSON.parse(profile.moderation_notes)
        } catch {
          prior = { previous_notes: profile.moderation_notes }
        }
        await admin
          .from('profiles')
          .update({
            moderation_notes: JSON.stringify({
              ...prior,
              photos: verdicts,
              photos_at: new Date().toISOString(),
            }),
          })
          .eq('id', profile_id)
      })
    }

    // ---- Always revalidate after any owner edit ---------------------
    await step.run('revalidate', async () => {
      const article = profile.articles?.[0]
      if (!article) return
      await revalidateProfile(
        { subdomain: profile.subdomain },
        { slug: article.slug },
      )
    })

    return { profile_id, changed_fields }
  },
)
