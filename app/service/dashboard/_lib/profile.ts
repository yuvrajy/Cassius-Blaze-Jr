import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/db'
import type { ProfileWithAssets } from '@/lib/contracts/profile'

// Load the signed-in user's single profile (v1: at most one per account)
// joined with photos + social_links so callers can render the dashboard
// without a second round-trip. If the user has multiple profile rows, we
// take the first and log — v1 is one-profile-per-user.
//
// Returns null when the user has no profile yet (paid signup hasn't
// finished, or signed up without paying — overview page handles this).
export async function loadOwnerProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileWithAssets | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, photos:photos(*), social_links:social_links(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[loadOwnerProfile] supabase error', error)
    return null
  }
  if (!data || data.length === 0) return null
  if (data.length > 1) {
    console.warn(
      `[loadOwnerProfile] user ${userId} has ${data.length} profiles, returning first`,
    )
  }
  const row = data[0]
  return sortAssets(row as unknown as ProfileWithAssets)
}

export async function loadProfileById(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<ProfileWithAssets | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, photos:photos(*), social_links:social_links(*)')
    .eq('id', profileId)
    .maybeSingle()
  if (error) {
    console.error('[loadProfileById] supabase error', error)
    return null
  }
  if (!data) return null
  return sortAssets(data as unknown as ProfileWithAssets)
}

export async function loadArticleByProfileId(
  supabase: SupabaseClient<Database>,
  profileId: string,
) {
  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()
  return data
}

function sortAssets(p: ProfileWithAssets): ProfileWithAssets {
  return {
    ...p,
    photos: [...(p.photos ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    social_links: [...(p.social_links ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }
}
