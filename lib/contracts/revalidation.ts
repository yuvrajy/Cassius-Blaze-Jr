// URL helpers and revalidation-path contracts shared across hostnames.
//
// Use these from any agent that needs to (a) build a cross-site URL or
// (b) tell Next which paths to invalidate after a content change. Keeping
// these in one place means a slug-format change touches one file, not five.

const NEWS_HOST = 'thenorm.info'
const SERVICE_HOST = 'getknown.com'

function parentDomain(): string {
  return process.env.NEXT_PUBLIC_PARENT_DOMAIN ?? 'iam.bio'
}

export interface ProfileLike {
  subdomain: string
}

export interface ArticleLike {
  slug: string
}

// Public-facing URLs for one profile across all surfaces.
export function profileUrls(profile: ProfileLike) {
  const parent = parentDomain()
  return {
    personal: `https://${profile.subdomain}.${parent}`,
    personalHost: `${profile.subdomain}.${parent}`,
  }
}

// Canonical public URL for one news article on thenorm.info.
export function articleUrl(article: ArticleLike): string {
  return `https://${NEWS_HOST}/article/${article.slug}`
}

// Internal Next.js paths to invalidate when an article publishes or changes.
// Background workers (agent 6) call revalidatePath() on each of these. The
// list is the *source of truth* — when you add a new news page, add its
// path here so publishing flows pick it up automatically.
export function newsRevalidationPaths(article: ArticleLike): string[] {
  return [
    '/news',
    '/news/about',
    `/news/article/${article.slug}`,
    '/news/sitemap.xml',
    '/news/rss.xml',
  ]
}

// Personal-site paths to invalidate on profile change.
export function personalRevalidationPaths(profile: ProfileLike): string[] {
  return [`/personal/${profile.subdomain}`]
}

// One-call helper that invalidates BOTH the personal site and its linked
// article in one go. Background workers (sub-agent 6 + 7) call this after
// any state change that affects what the public sees — moderation flips,
// owner edits, takedowns. The implementation lives behind a dynamic import
// of `next/cache` so this module stays usable from non-server contexts
// (e.g. a unit test) — the import only resolves at runtime on the server.
export async function revalidateProfile(
  profile: ProfileLike,
  article: ArticleLike,
): Promise<void> {
  const { revalidatePath } = await import('next/cache')
  for (const path of personalRevalidationPaths(profile)) revalidatePath(path)
  for (const path of newsRevalidationPaths(article)) revalidatePath(path)
}

export const HOSTS = {
  news: NEWS_HOST,
  service: SERVICE_HOST,
} as const
