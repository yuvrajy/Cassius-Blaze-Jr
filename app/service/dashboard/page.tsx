import Link from 'next/link'
import { ImageIcon, LinkIcon, PencilIcon } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fullUrlFor, primaryPhotoUrl } from '@/lib/contracts/profile'
import { articleUrl, profileUrls } from '@/lib/contracts/revalidation'
import { Button } from '@/components/ui/button'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { StatusBanner, StatusMessage } from '@/components/dashboard/status-banner'
import { UrlDisplay } from '@/components/dashboard/url-display'
import { loadOwnerProfile, loadArticleByProfileId } from './_lib/profile'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const profile = await loadOwnerProfile(supabase, user.id)

  return (
    <DashboardShell email={user.email} active="overview">
      {profile ? (
        <ProfileOverview profile={profile} />
      ) : (
        <NoProfileYet />
      )}
    </DashboardShell>
  )
}

async function ProfileOverview({
  profile,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof loadOwnerProfile>>>
}) {
  const supabase = await createClient()
  const article = await loadArticleByProfileId(supabase, profile.id)
  const heroPhoto = primaryPhotoUrl(profile)
  const urls = profileUrls(profile)

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {profile.display_name}
          </h1>
          {profile.tagline && (
            <p className="text-sm text-muted-foreground">{profile.tagline}</p>
          )}
        </div>
        <StatusBanner status={profile.status} />
      </header>

      <section className="space-y-4">
        <StatusMessage
          status={profile.status}
          notes={profile.moderation_notes}
        />

        {profile.status === 'live' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {article && (
              <UrlDisplay label="News article" url={articleUrl(article)} />
            )}
            <UrlDisplay label="Personal site" url={urls.personal} />
            {profile.bespoke_domain && (
              <UrlDisplay
                label="Bespoke domain"
                url={`https://${profile.bespoke_domain}`}
              />
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button size="sm" render={<Link href="/dashboard/edit" />}>
            <PencilIcon /> Edit profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/dashboard/photos" />}
          >
            <ImageIcon /> Manage photos
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/dashboard/billing" />}
          >
            Manage billing
          </Button>
          <Button
            size="sm"
            variant="ghost"
            render={<Link href="/dashboard/takedown" />}
          >
            Take down
          </Button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <DataBlock
            title="Bio"
            action={
              <Link
                href="/dashboard/edit"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Edit
              </Link>
            }
          >
            <p className="text-sm leading-relaxed text-muted-foreground line-clamp-6">
              {profile.bio}
            </p>
          </DataBlock>

          <DataBlock
            title="Social links"
            action={
              <Link
                href="/dashboard/edit"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Manage
              </Link>
            }
          >
            {profile.social_links.length === 0 ? (
              <p className="text-sm text-muted-foreground">None added yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {profile.social_links.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <LinkIcon className="size-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      {l.platform}
                    </span>
                    <a
                      href={fullUrlFor(l)}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-foreground hover:underline"
                    >
                      {l.value}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </DataBlock>
        </div>

        <div>
          <DataBlock
            title="Photos"
            action={
              <Link
                href="/dashboard/photos"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Manage
              </Link>
            }
          >
            {profile.photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No photos yet.</p>
            ) : (
              <div className="flex gap-2">
                {heroPhoto && (
                  <div className="aspect-square w-full max-w-32 overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroPhoto}
                      alt={profile.display_name}
                      className="size-full object-cover"
                    />
                  </div>
                )}
              </div>
            )}
          </DataBlock>
        </div>
      </section>
    </div>
  )
}

function DataBlock({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        {children}
      </div>
    </div>
  )
}

function NoProfileYet() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        No profile yet
      </h1>
      <p className="text-sm text-muted-foreground">
        Your account is signed in but we don&rsquo;t have a profile for you
        yet. Finish signup to publish.
      </p>
      <Button render={<Link href="/signup" />}>Go to signup</Button>
    </div>
  )
}
