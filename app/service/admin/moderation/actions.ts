'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidateProfile } from '@/lib/contracts/revalidation'
import {
  fireProfileUpdated,
  fireTakedownRequested,
} from '@/app/service/dashboard/_lib/events'

export type AdminResult = { ok: true } | { ok: false; error: string }

export async function approveProfile(profileId: string): Promise<AdminResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('id, status, subdomain')
    .eq('id', profileId)
    .maybeSingle()
  if (pErr || !profile) return { ok: false, error: pErr?.message ?? 'Not found' }

  const { error } = await admin
    .from('profiles')
    .update({ status: 'live', moderation_notes: null })
    .eq('id', profileId)
  if (error) return { ok: false, error: error.message }

  // Article publication: flip status to live, set published_at if it
  // wasn't set yet. The article row may not exist if generation hasn't
  // happened — that's fine, agent 6 will create it as part of the
  // SIGNUP_PAID flow.
  const { data: article } = await admin
    .from('articles')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (article) {
    await admin
      .from('articles')
      .update({
        status: 'live',
        published_at: article.published_at ?? new Date().toISOString(),
      })
      .eq('id', article.id)
    await revalidateProfile(profile, article)
  }

  // CONTRACT GAP (see handoff): events.ts has no ProfileApproved /
  // ProfileRejected event and PROFILE_UPDATED's payload uses
  // changed_fields, not an `action` flag. Fire PROFILE_UPDATED with an
  // empty changed_fields so agent 6 can pick the row up by status; the
  // status flip itself is the signal. Approval / rejection emails belong
  // in agent 6 and will likely want a dedicated event added to the
  // contract.
  await fireProfileUpdated({ profile_id: profileId, changed_fields: [] })

  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
  return { ok: true }
}

const RejectInput = z.object({
  profile_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
})

export async function rejectProfile(input: {
  profile_id: string
  reason: string
}): Promise<AdminResult> {
  await requireAdmin()
  const parsed = RejectInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Reason is required' }

  const admin = createAdminClient()
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('id, subdomain')
    .eq('id', parsed.data.profile_id)
    .maybeSingle()
  if (pErr || !profile) return { ok: false, error: pErr?.message ?? 'Not found' }

  const { error } = await admin
    .from('profiles')
    .update({
      status: 'rejected',
      moderation_notes: parsed.data.reason,
    })
    .eq('id', parsed.data.profile_id)
  if (error) return { ok: false, error: error.message }

  // Article (if it exists) also gets pulled — keep statuses aligned.
  const { data: article } = await admin
    .from('articles')
    .select('*')
    .eq('profile_id', parsed.data.profile_id)
    .maybeSingle()
  if (article) {
    await admin
      .from('articles')
      .update({ status: 'taken_down' })
      .eq('id', article.id)
    await revalidateProfile(profile, article)
  }

  // We fire BOTH PROFILE_UPDATED (so a reject email can be sent — see
  // contract-gap note in approveProfile) AND TAKEDOWN_REQUESTED with
  // requested_by='moderation' so agent 7's lifecycle worker deindexes
  // any public surfaces. The payload has a real reason field for this.
  await fireProfileUpdated({
    profile_id: parsed.data.profile_id,
    changed_fields: [],
  })
  await fireTakedownRequested({
    profile_id: parsed.data.profile_id,
    requested_by: 'moderation',
    reason: parsed.data.reason,
  })

  revalidatePath('/admin/moderation')
  revalidatePath('/admin')
  return { ok: true }
}
