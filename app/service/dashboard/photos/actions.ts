'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidateProfile } from '@/lib/contracts/revalidation'
import { fireProfileUpdated } from '../_lib/events'
import { loadOwnerProfile, loadArticleByProfileId } from '../_lib/profile'

const MAX_PHOTOS = 5

// Insert a photo row after the browser uploaded the binary to Supabase
// Storage. We trust storage_path because the storage RLS policy binds it
// to the authenticated user's id (see supabase/storage.sql); we re-check
// the prefix here as a belt-and-suspenders measure.
const AddPhotoInput = z.object({
  storage_path: z.string().min(1).max(500),
  consent_attested: z.literal(true),
  is_primary: z.boolean().optional(),
})
export type AddPhotoInput = z.infer<typeof AddPhotoInput>

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function addPhoto(input: AddPhotoInput): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = AddPhotoInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid input' }

  if (!parsed.data.storage_path.startsWith(`${user.id}/`)) {
    return { ok: false, error: 'Storage path mismatch' }
  }

  const supabase = await createClient()
  const profile = await loadOwnerProfile(supabase, user.id)
  if (!profile) return { ok: false, error: 'No profile' }
  if (profile.photos.length >= MAX_PHOTOS) {
    return { ok: false, error: 'You can have at most 5 photos' }
  }

  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null
  const ua = h.get('user-agent') ?? null

  const isFirst = profile.photos.length === 0
  const sortOrder = profile.photos.length
  const { error } = await supabase.from('photos').insert({
    profile_id: profile.id,
    storage_path: parsed.data.storage_path,
    variants: {},
    is_primary: parsed.data.is_primary ?? isFirst,
    sort_order: sortOrder,
    consent_logged: true,
    consent_ip: ip,
    consent_user_agent: ua,
    consent_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[photos:add] insert failed', error)
    return { ok: false, error: error.message }
  }

  await fireProfileUpdated({
    profile_id: profile.id,
    changed_fields: ['photos'],
  })

  const article = await loadArticleByProfileId(supabase, profile.id)
  if (article) await revalidateProfile(profile, article)

  return { ok: true }
}

export async function deletePhoto(photoId: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()
  const profile = await loadOwnerProfile(supabase, user.id)
  if (!profile) return { ok: false, error: 'No profile' }
  const photo = profile.photos.find((p) => p.id === photoId)
  if (!photo) return { ok: false, error: 'Photo not found' }

  // Use admin client only to remove the storage object — RLS on the
  // bucket lets the user delete their own object via the user-scoped
  // client, but we want to be safe across ext/case quirks. Still
  // user-scoped for the DB delete.
  const admin = createAdminClient()
  await admin.storage.from('photos').remove([photo.storage_path])

  const { error } = await supabase.from('photos').delete().eq('id', photoId)
  if (error) {
    console.error('[photos:delete] db delete failed', error)
    return { ok: false, error: error.message }
  }

  // If the deleted photo was primary, promote the next remaining one.
  if (photo.is_primary) {
    const remaining = profile.photos
      .filter((p) => p.id !== photoId)
      .sort((a, b) => a.sort_order - b.sort_order)
    if (remaining[0]) {
      await supabase
        .from('photos')
        .update({ is_primary: true })
        .eq('id', remaining[0].id)
    }
  }

  const article = await loadArticleByProfileId(supabase, profile.id)
  if (article) await revalidateProfile(profile, article)

  return { ok: true }
}

const ReorderInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_PHOTOS),
})
export type ReorderInput = z.infer<typeof ReorderInput>

export async function reorderPhotos(input: ReorderInput): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = ReorderInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid input' }

  const supabase = await createClient()
  const profile = await loadOwnerProfile(supabase, user.id)
  if (!profile) return { ok: false, error: 'No profile' }

  const ownedIds = new Set(profile.photos.map((p) => p.id))
  if (parsed.data.ids.some((id) => !ownedIds.has(id))) {
    return { ok: false, error: 'Photo not owned' }
  }

  for (let i = 0; i < parsed.data.ids.length; i++) {
    const { error } = await supabase
      .from('photos')
      .update({ sort_order: i })
      .eq('id', parsed.data.ids[i])
    if (error) {
      console.error('[photos:reorder] update failed', error)
      return { ok: false, error: error.message }
    }
  }

  const article = await loadArticleByProfileId(supabase, profile.id)
  if (article) await revalidateProfile(profile, article)
  return { ok: true }
}

export async function setPrimary(photoId: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()
  const profile = await loadOwnerProfile(supabase, user.id)
  if (!profile) return { ok: false, error: 'No profile' }
  if (!profile.photos.some((p) => p.id === photoId)) {
    return { ok: false, error: 'Photo not owned' }
  }

  // Two-step toggle: clear all primaries, then set the chosen one. The
  // exactly-one-primary invariant is enforced by this pair plus the DB's
  // existing partial unique index (see 0001_initial_schema.sql).
  const { error: clr } = await supabase
    .from('photos')
    .update({ is_primary: false })
    .eq('profile_id', profile.id)
  if (clr) return { ok: false, error: clr.message }
  const { error: set } = await supabase
    .from('photos')
    .update({ is_primary: true })
    .eq('id', photoId)
  if (set) return { ok: false, error: set.message }

  const article = await loadArticleByProfileId(supabase, profile.id)
  if (article) await revalidateProfile(profile, article)
  return { ok: true }
}
