'use server'

import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fireProfileUpdated } from '../_lib/events'
import { loadOwnerProfile, loadArticleByProfileId } from '../_lib/profile'
import { revalidateProfile } from '@/lib/contracts/revalidation'
import { SocialPlatform } from '@/lib/contracts/signup'
import type { ProfileUpdatedPayload } from '@/lib/contracts/events'

// Zod-mirrors the slice of SignupInput that's editable post-signup. We
// don't import SignupInput.pick() because the contract's Zod object isn't
// public-typed for picking; we re-state the fields here so a contract
// drift surfaces as a TypeScript error.
const EditInput = z.object({
  tagline: z.string().max(120).nullable(),
  bio: z.string().min(50).max(7000),
  social_links: z
    .array(
      z.object({
        platform: SocialPlatform,
        value: z.string().min(1).max(500),
      }),
    )
    .max(6),
})
export type EditInput = z.infer<typeof EditInput>

export type EditResult =
  | { ok: true; bio_changed: boolean }
  | { ok: false; error: string }

export async function saveProfile(input: EditInput): Promise<EditResult> {
  const user = await requireUser()
  const parsed = EditInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const profile = await loadOwnerProfile(supabase, user.id)
  if (!profile) return { ok: false, error: 'No profile to edit' }

  const normalizedTagline = parsed.data.tagline?.trim() || null
  const bioChanged = parsed.data.bio.trim() !== profile.bio.trim()
  const taglineChanged = normalizedTagline !== profile.tagline
  const socialsChanged = !sameSocials(profile.social_links, parsed.data.social_links)

  // Update profile row. Bio edits flip status back to pending_moderation
  // so agent 6 re-runs Claude bio review before the change goes live.
  const profileUpdate = {
    tagline: normalizedTagline,
    bio: parsed.data.bio,
    ...(bioChanged
      ? { status: 'pending_moderation' as const, moderation_notes: null }
      : {}),
  }

  const { error: profErr } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', profile.id)
  if (profErr) {
    console.error('[edit] profile update failed', profErr)
    return { ok: false, error: profErr.message }
  }

  if (socialsChanged) {
    const { error: delErr } = await supabase
      .from('social_links')
      .delete()
      .eq('profile_id', profile.id)
    if (delErr) {
      console.error('[edit] social delete failed', delErr)
      return { ok: false, error: delErr.message }
    }
    if (parsed.data.social_links.length > 0) {
      const rows = parsed.data.social_links.map((l, i) => ({
        profile_id: profile.id,
        platform: l.platform,
        value: l.value,
        sort_order: i,
      }))
      const { error: insErr } = await supabase.from('social_links').insert(rows)
      if (insErr) {
        console.error('[edit] social insert failed', insErr)
        return { ok: false, error: insErr.message }
      }
    }
  }

  const changed: ProfileUpdatedPayload['changed_fields'] = []
  if (bioChanged) changed.push('bio')
  if (taglineChanged) changed.push('tagline')
  if (socialsChanged) changed.push('social_links')

  if (changed.length > 0) {
    await fireProfileUpdated({
      profile_id: profile.id,
      changed_fields: changed,
    })
  }

  const article = await loadArticleByProfileId(supabase, profile.id)
  if (article) await revalidateProfile(profile, article)

  return { ok: true, bio_changed: bioChanged }
}

function sameSocials(
  a: { platform: string; value: string }[],
  b: { platform: string; value: string }[],
): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].platform !== b[i].platform || a[i].value !== b[i].value) return false
  }
  return true
}
