import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { PhotoManager } from '@/components/dashboard/photo-manager'
import { loadOwnerProfile } from '../_lib/profile'

export const metadata = { title: 'Photos' }

export default async function PhotosPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const profile = await loadOwnerProfile(supabase, user.id)

  const initialPhotos = await Promise.all(
    (profile?.photos ?? []).map(async (p) => ({
      id: p.id,
      is_primary: p.is_primary,
      sort_order: p.sort_order,
      storage_path: p.storage_path,
      preview_url:
        p.variants?.medium ??
        p.variants?.thumb ??
        (await signedUrl(supabase, p.storage_path)),
    })),
  )

  return (
    <DashboardShell email={user.email} active="photos">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
          <ArrowLeftIcon /> Back to dashboard
        </Button>

        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Photos
          </h1>
          <p className="text-sm text-muted-foreground">
            Up to 5 photos. Drag to reorder. Star one to mark it primary —
            it&rsquo;s the photo we use in the article hero and the personal
            site OG card.
          </p>
        </header>

        {profile ? (
          <PhotoManager profileId={profile.id} initialPhotos={initialPhotos} />
        ) : (
          <p className="text-sm text-muted-foreground">No profile yet.</p>
        )}
      </div>
    </DashboardShell>
  )
}

async function signedUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
): Promise<string> {
  const { data } = await supabase.storage
    .from('photos')
    .createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? ''
}
