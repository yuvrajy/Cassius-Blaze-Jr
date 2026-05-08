'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { revalidateProfile } from '@/lib/contracts/revalidation'
import { fireTakedownRequested } from '../_lib/events'
import { loadOwnerProfile, loadArticleByProfileId } from '../_lib/profile'

const Input = z.object({
  reason: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null)),
})

export async function requestTakedown(formData: FormData): Promise<void> {
  const user = await requireUser()
  const parsed = Input.safeParse({ reason: formData.get('reason') })
  if (!parsed.success) {
    redirect('/dashboard/takedown?error=invalid')
  }

  const supabase = await createClient()
  const profile = await loadOwnerProfile(supabase, user.id)
  if (!profile) redirect('/dashboard?error=no_profile')

  const reason = parsed.data.reason

  // Soft delete only — flip status, log the takedown, fire the event.
  // Agent 7's lifecycle worker handles deindexing, domain release if
  // there's a bespoke domain, and the cooling-period cleanup.
  const { error: profErr } = await supabase
    .from('profiles')
    .update({ status: 'taken_down' })
    .eq('id', profile.id)
  if (profErr) {
    console.error('[takedown] profile update failed', profErr)
    redirect('/dashboard/takedown?error=db')
  }

  const { error: tdErr } = await supabase.from('takedowns').insert({
    profile_id: profile.id,
    reason,
    requested_by: 'customer',
  })
  if (tdErr) console.error('[takedown] takedown insert failed', tdErr)

  await fireTakedownRequested({
    profile_id: profile.id,
    requested_by: 'customer',
    reason: reason ?? undefined,
  })

  const article = await loadArticleByProfileId(supabase, profile.id)
  if (article) await revalidateProfile(profile, article)

  redirect('/dashboard?takedown=ok')
}
