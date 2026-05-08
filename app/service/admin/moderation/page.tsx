import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminShell } from '@/components/admin/admin-shell'
import { ModerationCard } from '@/components/admin/moderation-card'

export const metadata = { title: 'Moderation queue' }

export default async function ModerationPage() {
  const user = await requireAdmin()
  const admin = createAdminClient()

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('*, photos:photos(*)')
    .eq('status', 'pending_moderation')
    .order('created_at', { ascending: true })

  if (error) console.error('[moderation] load failed', error)

  // Pre-sign storage URLs once on the server so the operator's browser
  // doesn't have to round-trip per photo. 1-hour TTL is plenty for a
  // single review session.
  const expanded = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const photos = await Promise.all(
        ((p.photos ?? []) as Array<{
          id: string
          storage_path: string
          is_primary: boolean
          variants: { thumb?: string; medium?: string }
          sort_order: number
        }>)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(async (ph) => {
            const preview =
              ph.variants?.medium ??
              ph.variants?.thumb ??
              (
                await admin.storage
                  .from('photos')
                  .createSignedUrl(ph.storage_path, 3600)
              ).data?.signedUrl ??
              ''
            return {
              id: ph.id,
              preview_url: preview,
              is_primary: ph.is_primary,
            }
          }),
      )
      return { profile: p, photos }
    }),
  )

  return (
    <AdminShell email={user.email} active="moderation">
      <div className="space-y-6">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Moderation queue
            </h1>
            <p className="text-sm text-muted-foreground">
              {expanded.length} profile{expanded.length === 1 ? '' : 's'}{' '}
              awaiting review · oldest first
            </p>
          </div>
        </header>

        {expanded.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
            Nothing in the queue. 🎉
          </div>
        ) : (
          <ul className="space-y-4">
            {expanded.map(({ profile, photos }) => (
              <li key={profile.id}>
                <ModerationCard
                  profileId={profile.id}
                  displayName={profile.display_name}
                  subdomain={profile.subdomain}
                  tagline={profile.tagline}
                  bio={profile.bio}
                  createdAt={profile.created_at}
                  moderationNotes={profile.moderation_notes}
                  photos={photos}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  )
}
