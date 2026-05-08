'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidateProfile } from '@/lib/contracts/revalidation'
import {
  fireProfileUpdated,
  fireTakedownRequested,
} from '@/app/service/dashboard/_lib/events'

export type AdminResult = { ok: true } | { ok: false; error: string }

export async function adminForceTakedown(
  profileId: string,
  reason?: string,
): Promise<AdminResult> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle()
  if (!profile) return { ok: false, error: 'Not found' }

  const { error } = await admin
    .from('profiles')
    .update({ status: 'taken_down' })
    .eq('id', profileId)
  if (error) return { ok: false, error: error.message }

  await admin.from('takedowns').insert({
    profile_id: profileId,
    reason: reason ?? null,
    requested_by: 'admin',
  })

  await fireTakedownRequested({
    profile_id: profileId,
    requested_by: 'admin',
    reason,
  })

  const { data: article } = await admin
    .from('articles')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (article) await revalidateProfile(profile, article)

  revalidatePath(`/admin/customers/${profileId}`)
  return { ok: true }
}

export async function adminResetToPending(profileId: string): Promise<AdminResult> {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle()
  if (!profile) return { ok: false, error: 'Not found' }

  const { error } = await admin
    .from('profiles')
    .update({ status: 'pending_moderation', moderation_notes: null })
    .eq('id', profileId)
  if (error) return { ok: false, error: error.message }

  await fireProfileUpdated({ profile_id: profileId, changed_fields: ['bio'] })

  const { data: article } = await admin
    .from('articles')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (article) await revalidateProfile(profile, article)

  revalidatePath(`/admin/customers/${profileId}`)
  revalidatePath('/admin/moderation')
  return { ok: true }
}
