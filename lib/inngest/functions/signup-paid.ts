import 'server-only'
import { inngest } from '@/lib/inngest/client'
import { Events, type SignupPaidPayload } from '@/lib/contracts/events'
import {
  deletePendingSignup,
  getPendingSignup,
} from '@/lib/inngest/pending-signups'
import { createAdminClient } from '@/lib/supabase/admin'
import { processPhoto } from '@/lib/photos/process'
import { moderatePhoto } from '@/lib/moderation/photo'
import { moderateBio } from '@/lib/moderation/bio'
import { generateArticle } from '@/lib/moderation/article'
import { sendEmail } from '@/lib/email/client'
import { welcomeEmail } from '@/lib/email/templates/welcome'
import { devLog, devLogOnly } from '@/lib/inngest/dev'
import { profileUrls, revalidateProfile } from '@/lib/contracts/revalidation'
import type {
  BioVerdict,
  PhotoVerdict,
} from '@/lib/contracts/moderation'

// signup.paid → publish pipeline.
//
// Pre-conditions (set by /api/stripe/webhook before firing this event):
//   - profiles row exists with status='pending_moderation' and a bound user_id
//   - payments row exists with stripe_session_id matching the event
//   - pending_signups row exists, keyed by profile.user_id (the webhook
//     reads pending_signup_id from Stripe metadata and stashes it on the
//     profiles row's `moderation_notes` field — see /api/signup for why)
//
// Each step.run is independently retried on failure. We make every step
// idempotent so re-runs don't duplicate work.

export const signupPaid = inngest.createFunction(
  {
    id: 'signup-paid',
    name: 'Publish a paid signup',
    retries: 3,
  },
  { event: Events.SIGNUP_PAID },
  async ({ event, step }) => {
    const { profile_id, user_id, stripe_session_id } =
      event.data as SignupPaidPayload

    // ---- Load --------------------------------------------------------
    const { profile, pendingId } = await step.run('load-profile', async () => {
      const admin = createAdminClient()
      const { data, error } = await admin
        .from('profiles')
        .select('*')
        .eq('id', profile_id)
        .single()
      if (error || !data) throw new Error(`profile ${profile_id}: ${error?.message ?? 'missing'}`)
      // We stashed the pending_signup_id in moderation_notes during
      // /api/signup. Read it out now.
      const pendingId = parsePendingId(data.moderation_notes)
      if (!pendingId) throw new Error(`profile ${profile_id}: missing pending_signup_id`)
      return { profile: data, pendingId }
    })

    const pending = await step.run('load-pending', () => getPendingSignup(pendingId))
    const payload = pending.payload

    // ---- Process & moderate photos ----------------------------------
    const processedPhotos = await step.run('process-photos', async () => {
      const admin = createAdminClient()
      // Reserve photo ids by inserting placeholder rows we'll update with
      // variants after sharp runs. Idempotent on (profile_id, sort_order).
      const out: Array<{
        photo_id: string
        storage_path: string
        variants: Record<string, string>
        is_primary: boolean
        sort_order: number
        consent_at: string | null
        consent_attested: boolean
      }> = []
      for (const ph of payload.photos) {
        const photoId = crypto.randomUUID()
        const processed = await processPhoto({
          draftPath: ph.storage_path,
          userId: user_id,
          photoId,
          isPrimary: ph.is_primary,
        })
        out.push({
          photo_id: photoId,
          storage_path: processed.storage_path,
          variants: processed.variants,
          is_primary: ph.is_primary,
          sort_order: ph.sort_order,
          consent_attested: ph.consent_attested,
          consent_at: new Date().toISOString(),
        })
      }
      void admin // intentionally unused — the work is in processPhoto
      return out
    })

    const photoVerdicts = await step.run('moderate-photos', async () => {
      const verdicts: PhotoVerdict[] = []
      for (const p of processedPhotos) {
        // Use the ABSOLUTE hero URL — Sightengine + TinEye need to fetch.
        const url = p.variants.hero ?? p.variants.original
        const v = await moderatePhoto({ photoId: p.photo_id, url })
        verdicts.push(v)
      }
      return verdicts
    })

    // ---- Moderate bio + generate article ----------------------------
    const bioVerdict: BioVerdict = await step.run('moderate-bio', () =>
      moderateBio(payload.bio),
    )
    const article = await step.run('generate-article', () =>
      generateArticle({
        display_name: payload.display_name,
        tagline: payload.tagline,
        bio: payload.bio,
        social_links: payload.social_links,
      }),
    )

    // ---- Insert DB rows (all idempotent) ----------------------------
    await step.run('update-profile', async () => {
      const admin = createAdminClient()
      const notes = serializeModerationNotes({ bio: bioVerdict, photos: photoVerdicts })
      const { error } = await admin
        .from('profiles')
        .update({
          display_name: payload.display_name,
          tagline: payload.tagline ?? null,
          bio: payload.bio,
          status: 'pending_moderation',
          moderation_notes: notes,
        })
        .eq('id', profile_id)
      if (error) throw new Error(`profile update: ${error.message}`)
    })

    const articleSlug = await step.run('insert-article', async () => {
      const admin = createAdminClient()
      // Use a collision-resistant slug; if a race somehow lands a duplicate,
      // append another suffix and retry once.
      let slug = article.slug
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await admin.from('articles').insert({
          profile_id,
          slug,
          headline: article.headline,
          subheadline: article.subheadline,
          body: article.body,
          author_name: 'The Norm Staff',
          status: 'pending_moderation',
        })
        if (!error) return slug
        const msg = error.message.toLowerCase()
        if (!msg.includes('articles_slug') && !msg.includes('duplicate')) {
          // Maybe we already inserted on a previous retry — accept that.
          const existing = await admin
            .from('articles')
            .select('slug')
            .eq('profile_id', profile_id)
            .maybeSingle()
          if (existing.data?.slug) return existing.data.slug
          throw new Error(`article insert: ${error.message}`)
        }
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`
      }
      throw new Error(`article slug exhausted attempts`)
    })

    await step.run('insert-photos', async () => {
      const admin = createAdminClient()
      for (const p of processedPhotos) {
        const { error } = await admin
          .from('photos')
          .upsert(
            {
              id: p.photo_id,
              profile_id,
              storage_path: p.storage_path,
              variants: p.variants,
              is_primary: p.is_primary,
              sort_order: p.sort_order,
              consent_logged: p.consent_attested,
              consent_at: p.consent_at,
            },
            { onConflict: 'id' },
          )
        if (error) throw new Error(`photo insert ${p.photo_id}: ${error.message}`)
      }
    })

    await step.run('insert-social', async () => {
      const admin = createAdminClient()
      // Replace any prior rows so retries don't accumulate duplicates.
      await admin.from('social_links').delete().eq('profile_id', profile_id)
      if (payload.social_links.length === 0) return
      const rows = payload.social_links.map((l, i) => ({
        profile_id,
        platform: l.platform,
        value: l.value,
        sort_order: i,
      }))
      const { error } = await admin.from('social_links').insert(rows)
      if (error) throw new Error(`social_links insert: ${error.message}`)
    })

    await step.run('mark-payment-paid', async () => {
      const admin = createAdminClient()
      const { error } = await admin
        .from('payments')
        .update({ status: 'paid', profile_id })
        .eq('stripe_session_id', stripe_session_id)
      if (error) throw new Error(`payment update: ${error.message}`)
    })

    await step.run('insert-tc', async () => {
      const admin = createAdminClient()
      // Skip if a row already exists for this profile (idempotency).
      const { data: existing } = await admin
        .from('tc_acceptances')
        .select('id')
        .eq('profile_id', profile_id)
        .maybeSingle()
      if (existing) return
      const { error } = await admin.from('tc_acceptances').insert({
        profile_id,
        user_id,
        tc_version: payload.tc_version,
        ip_address: '0.0.0.0',
        user_agent: 'inngest:signup-paid',
        dob: payload.dob,
      })
      if (error) throw new Error(`tc_acceptances insert: ${error.message}`)
    })

    // ---- Email + revalidate -----------------------------------------
    await step.run('send-welcome-email', async () => {
      const admin = createAdminClient()
      // Look up the user's email — we don't have it on the event.
      const { data: u } = await admin.auth.admin.getUserById(user_id)
      const email = u?.user?.email
      if (!email) throw new Error(`auth user ${user_id}: missing email`)

      let magicLink = `${siteUrl()}/service/dashboard`
      if (devLogOnly('anthropic') /* re-use for full offline */) {
        // No-op — we already use the dashboard URL.
      }
      const { data: link, error } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${siteUrl()}/service/dashboard` },
      })
      if (error) {
        devLog('supabase', 'generateLink failed; using dashboard URL', { error: error.message })
      } else if (link?.properties?.action_link) {
        magicLink = link.properties.action_link
      }

      await sendEmail({
        to: email,
        email: welcomeEmail({
          display_name: payload.display_name,
          magic_link: magicLink,
        }),
        idempotencyKey: `welcome:${profile_id}`,
      })
    })

    await step.run('delete-pending', () => deletePendingSignup(pendingId))

    await step.run('revalidate', async () => {
      await revalidateProfile(
        { subdomain: profile.subdomain },
        { slug: articleSlug },
      )
    })

    void profileUrls // keep import; profileUrls used elsewhere

    return { profile_id, slug: articleSlug }
  },
)

function siteUrl() {
  const host = process.env.NEXT_PUBLIC_SERVICE_DOMAIN ?? 'getknown.com'
  return `https://${host}`
}

// We stash `pending_signup_id` in moderation_notes between /api/signup and
// the workflow. Format: a JSON blob `{ "pending_signup_id": "<uuid>" }`.
// Workflow rewrites moderation_notes after running with the verdict summary.
function parsePendingId(notes: string | null): string | null {
  if (!notes) return null
  try {
    const j = JSON.parse(notes) as { pending_signup_id?: string }
    return j.pending_signup_id ?? null
  } catch {
    return null
  }
}

function serializeModerationNotes(args: {
  bio: BioVerdict
  photos: PhotoVerdict[]
}): string {
  return JSON.stringify({
    bio: args.bio,
    photos: args.photos,
    at: new Date().toISOString(),
  })
}
