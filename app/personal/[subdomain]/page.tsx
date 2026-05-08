import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ProfileWithAssets } from '@/lib/contracts/profile'
import type { PhotoRow, ProfileRow, SocialLinkRow } from '@/lib/types/db'
import { Hero } from '@/components/personal/hero'
import { Bio } from '@/components/personal/bio'
import { PhotoGallery } from '@/components/personal/photo-gallery'
import { NewsLink } from '@/components/personal/news-link'
import { PersonJsonLd } from '@/components/personal/person-jsonld'
import {
  heroPhotoUrl,
  parentDomain,
  serviceDomain,
  splitDisplayName,
  truncate,
} from '@/components/personal/helpers'

export const revalidate = 60

interface PageParams {
  subdomain: string
}

interface ProfilePayload extends ProfileWithAssets {
  article: { slug: string; headline: string | null } | null
}

// The hand-written Database type ships with empty `Relationships` arrays, so
// supabase-js can't infer the shape of nested selects and types them as
// `never`. We narrow once at the boundary so the rest of the lane is typed.
type ProfileFetchRow = ProfileRow & {
  photos: PhotoRow[] | null
  social_links: SocialLinkRow[] | null
  articles:
    | Array<{ slug: string; headline: string | null; status: string }>
    | null
}

async function getProfile(subdomain: string): Promise<ProfilePayload | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*, photos(*), social_links(*), articles(slug, headline, status)')
    .eq('subdomain', subdomain)
    .eq('status', 'live')
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as ProfileFetchRow
  const liveArticle =
    row.articles?.find((a) => a.status === 'live') ?? null

  return {
    ...row,
    photos: row.photos ?? [],
    social_links: row.social_links ?? [],
    article: liveArticle
      ? { slug: liveArticle.slug, headline: liveArticle.headline }
      : null,
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>
}): Promise<Metadata> {
  const { subdomain } = await params
  const profile = await getProfile(subdomain)
  if (!profile) {
    return {
      title: 'Not found',
      robots: { index: false, follow: false },
    }
  }

  const parent = parentDomain()
  const canonical = `https://${subdomain}.${parent}`
  const title = profile.tagline?.trim()
    ? `${profile.display_name} — ${profile.tagline.trim()}`
    : profile.display_name
  const description =
    profile.tagline?.trim() || truncate(profile.bio, 155)
  const { firstName, lastName } = splitDisplayName(profile.display_name)
  const heroImage = heroPhotoUrl(profile.photos)

  const alternateLinks: Record<string, string> = {}
  if (profile.bespoke_domain) {
    alternateLinks[`https://${profile.bespoke_domain}`] =
      `https://${profile.bespoke_domain}`
  }

  return {
    metadataBase: new URL(canonical),
    title,
    description,
    alternates: {
      canonical,
      ...(profile.bespoke_domain
        ? { types: { 'text/html': `https://${profile.bespoke_domain}` } }
        : {}),
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'profile',
      url: canonical,
      siteName: profile.display_name,
      title,
      description,
      firstName,
      lastName,
      // Next auto-resolves opengraph-image.tsx; we additionally include the
      // primary photo as a fallback for clients that bypass the route.
      ...(heroImage
        ? { images: [{ url: heroImage, width: 1200, height: 1200 }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(heroImage ? { images: [heroImage] } : {}),
    },
    other: profile.bespoke_domain
      ? { 'og:see_also': `https://${profile.bespoke_domain}` }
      : undefined,
  }
}

export default async function PersonalSitePage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { subdomain } = await params
  const profile = await getProfile(subdomain)
  if (!profile) notFound()

  const parent = parentDomain()
  const service = serviceDomain()
  const year = new Date().getFullYear()

  return (
    <>
      <PersonJsonLd profile={profile} />

      <Hero profile={profile} />

      <Bio text={profile.bio} displayName={profile.display_name} />

      <PhotoGallery photos={profile.photos} displayName={profile.display_name} />

      {profile.article && (
        <NewsLink
          articleSlug={profile.article.slug}
          articleHeadline={profile.article.headline}
          displayName={profile.display_name}
        />
      )}

      <footer className="bg-[#0d0d10] px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 border-t border-[#c9a84c]/10 pt-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="pn-sans text-[0.7rem] uppercase tracking-[0.18em] text-[#8a8a96]">
            {year} · {profile.display_name}
          </p>
          <p className="pn-sans text-[0.62rem] uppercase tracking-[0.22em] text-[#8a8a96]">
            <span className="mr-2 inline-block">{subdomain}.{parent}</span>
            <span aria-hidden className="mx-2 text-[#c9a84c]/40">·</span>
            <a
              href={`https://${service}`}
              className="text-[#8a8a96] underline-offset-4 transition hover:text-[#c9a84c] hover:underline"
            >
              Made on Get Known
            </a>
          </p>
        </div>
      </footer>
    </>
  )
}
