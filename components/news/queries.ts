import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { ArticleWithProfile } from '@/lib/contracts/profile'

// All public article queries live here. Each one filters status='live' on
// both sides of the join even though RLS already enforces it — explicit
// reads are easier to audit, and they protect the page if RLS is ever
// relaxed for an admin role.
//
// These helpers return null/[] on error rather than throwing, so the news
// pages can degrade to an empty state instead of crashing.

const ARTICLE_SELECT = `
  *,
  profile:profiles!inner (
    *,
    photos (*),
    social_links (*)
  )
`

export interface ArticleListResult {
  articles: ArticleWithProfile[]
  total: number
}

export async function listLiveArticles(opts: {
  limit: number
  offset: number
}): Promise<ArticleListResult> {
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('articles')
    .select(ARTICLE_SELECT, { count: 'exact' })
    .eq('status', 'live')
    .eq('profile.status', 'live')
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (error || !data) {
    return { articles: [], total: 0 }
  }
  return {
    articles: (data as unknown as ArticleWithProfile[]).filter(
      (a) => a.profile,
    ),
    total: count ?? 0,
  }
}

export async function getLiveArticleBySlug(
  slug: string,
): Promise<ArticleWithProfile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('articles')
    .select(ARTICLE_SELECT)
    .eq('slug', slug)
    .eq('status', 'live')
    .eq('profile.status', 'live')
    .maybeSingle()

  if (error || !data) return null
  const article = data as unknown as ArticleWithProfile
  if (!article.profile) return null
  return article
}

export async function listRelatedArticles(opts: {
  excludeId: string
  limit: number
}): Promise<ArticleWithProfile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('articles')
    .select(ARTICLE_SELECT)
    .eq('status', 'live')
    .eq('profile.status', 'live')
    .neq('id', opts.excludeId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(opts.limit)

  if (error || !data) return []
  return (data as unknown as ArticleWithProfile[]).filter((a) => a.profile)
}

// Used by the sitemap and RSS routes — small payload (no joins needed).
export async function listLiveArticleSlugs(opts: {
  limit?: number
} = {}): Promise<
  { slug: string; updated_at: string; published_at: string | null }[]
> {
  const supabase = await createClient()
  let q = supabase
    .from('articles')
    .select('slug, updated_at, published_at')
    .eq('status', 'live')
    .order('published_at', { ascending: false, nullsFirst: false })
  if (opts.limit) q = q.limit(opts.limit)
  const { data, error } = await q
  if (error || !data) return []
  return data
}

// RSS needs the headline + subhead alongside the slug, so RSS does a
// slightly heavier query than the sitemap.
export async function listLiveArticlesForFeed(opts: {
  limit: number
}): Promise<
  {
    slug: string
    headline: string
    subheadline: string | null
    body: string
    author_name: string
    published_at: string | null
    updated_at: string
  }[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('articles')
    .select(
      'slug, headline, subheadline, body, author_name, published_at, updated_at',
    )
    .eq('status', 'live')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(opts.limit)
  if (error || !data) return []
  return data
}
