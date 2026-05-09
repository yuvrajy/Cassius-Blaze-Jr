import type {
  ArticleRow,
  PhotoRow,
  ProfileRow,
  SocialLinkRow,
  SocialPlatform,
} from '@/lib/types/db'

// Joined "profile + everything we need to render" shape used by the personal
// site, the news site, and admin tools. Producers (server queries) should
// shape their .select() to match this; consumers should import this type.
export interface ProfileWithAssets extends ProfileRow {
  photos: PhotoRow[]
  social_links: SocialLinkRow[]
}

// The shape an article page needs: the article row plus its profile (with
// photos and socials) so the news article can render byline, hero photo,
// gallery, and the cross-link to the personal subdomain.
export interface ArticleWithProfile extends ArticleRow {
  profile: ProfileWithAssets
}

// What sub-agent 5's owner dashboard reads. Today identical to
// ProfileWithAssets — the underlying ProfileRow already carries every
// owner-only field (status, moderation_notes, expires_at,
// expiry_warning_sent_at, takedown_finalized_at, bespoke_domain*). The
// alias exists so dashboard code names the intent ("this is the owner's
// view of their own profile") and so we have a place to narrow the public
// shape later without renaming consumers.
export type OwnerProfileView = ProfileWithAssets

// Convert a (platform, value) pair into the canonical public URL for that
// person on that platform. Used for sameAs / Knowledge Graph linking and
// for the "find me elsewhere" footer on both the news article and the
// personal site. Keep platforms in sync with the social_platform check
// constraint in 0001_initial_schema.sql.
export function fullUrlFor(link: { platform: SocialPlatform; value: string }): string {
  const v = link.value.trim()
  switch (link.platform) {
    case 'twitter':
      return `https://twitter.com/${stripLeadingAt(v)}`
    case 'instagram':
      return `https://instagram.com/${stripLeadingAt(v)}`
    case 'linkedin':
      return v.startsWith('http') ? v : `https://www.linkedin.com/in/${v}`
    case 'github':
      return `https://github.com/${stripLeadingAt(v)}`
    case 'tiktok':
      return `https://www.tiktok.com/@${stripLeadingAt(v)}`
    case 'youtube':
      return v.startsWith('http')
        ? v
        : `https://www.youtube.com/${v.startsWith('@') ? v : `@${v}`}`
    case 'email':
      return v.startsWith('mailto:') ? v : `mailto:${v}`
    case 'website':
      return v.startsWith('http') ? v : `https://${v}`
  }
}

function stripLeadingAt(v: string): string {
  return v.startsWith('@') ? v.slice(1) : v
}

// Pick the URL of the largest photo variant we have, falling back to the
// raw storage path if variants haven't been generated yet.
export function primaryPhotoUrl(profile: ProfileWithAssets): string | null {
  const primary = profile.photos.find((p) => p.is_primary) ?? profile.photos[0]
  if (!primary) return null
  return (
    primary.variants?.large ??
    primary.variants?.medium ??
    primary.variants?.original ??
    primary.storage_path
  )
}
