import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getLiveArticleBySlug,
  listRelatedArticles,
} from '@/components/news/queries'
import { primaryPhotoUrl } from '@/lib/contracts/profile'
import { articleUrl, profileUrls } from '@/lib/contracts/revalidation'
import { Photo } from '@/components/news/photo'
import { Byline } from '@/components/news/byline'
import { ArticleBody } from '@/components/news/article-body'
import { ProfileCallout } from '@/components/news/profile-callout'
import { PhotoGallery } from '@/components/news/photo-gallery'
import { SocialRow } from '@/components/news/social-row'
import { RelatedStories } from '@/components/news/related-stories'
import { NewsArticleJsonLd } from '@/components/news/news-article-jsonld'

export const revalidate = 60

type Params = { slug: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getLiveArticleBySlug(slug)
  if (!article) {
    return { title: 'Story not found' }
  }

  const description =
    article.subheadline ??
    article.body.replace(/\s+/g, ' ').slice(0, 155).trim()
  const photoUrl = primaryPhotoUrl(article.profile)
  const canonical = articleUrl(article)

  return {
    title: `${article.headline} — The Norm`,
    description,
    authors: [{ name: article.author_name }],
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title: article.headline,
      description,
      url: canonical,
      siteName: 'The Norm',
      ...(photoUrl ? { images: [{ url: photoUrl }] } : {}),
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at,
      authors: [article.author_name],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.headline,
      description,
      ...(photoUrl ? { images: [photoUrl] } : {}),
    },
  }
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const article = await getLiveArticleBySlug(slug)
  if (!article) notFound()

  const heroPhoto = primaryPhotoUrl(article.profile)
  const related = await listRelatedArticles({
    excludeId: article.id,
    limit: 3,
  })
  const { personal } = profileUrls(article.profile)

  return (
    <>
      <NewsArticleJsonLd article={article} />

      <article className="mx-auto max-w-6xl px-6 pb-16">
        {/* Headline block */}
        <header className="mx-auto max-w-3xl pt-10 pb-6 text-center">
          <p className="norm-kicker">Profile</p>
          <h1
            className="norm-headline-xl mt-3 text-[2.25rem] sm:text-[3rem] md:text-[3.75rem]"
            style={{ letterSpacing: '-0.02em' }}
          >
            {article.headline}
          </h1>
          {article.subheadline ? (
            <p className="mx-auto mt-5 max-w-2xl font-serif text-xl leading-snug text-[var(--norm-muted)]">
              {article.subheadline}
            </p>
          ) : null}
        </header>

        <div className="mx-auto max-w-3xl">
          <Byline
            authorName={article.author_name}
            publishedAt={article.published_at}
            body={article.body}
          />
        </div>

        {/* Hero photo, full-bleed within content column. */}
        <div className="mx-auto mt-8 max-w-5xl">
          <Photo
            src={heroPhoto}
            alt={article.profile.display_name}
            className="aspect-[16/10]"
            sizes="(min-width: 1024px) 960px, 100vw"
            priority
          />
          {article.profile.tagline ? (
            <p className="norm-kicker mt-2 text-right">
              {article.profile.display_name} — {article.profile.tagline}
            </p>
          ) : (
            <p className="norm-kicker mt-2 text-right">
              {article.profile.display_name}
            </p>
          )}
        </div>

        {/* Body + mid-article callout. The body column is narrow on purpose
            for reading comfort (~70ch). */}
        <div className="mx-auto mt-10 max-w-[70ch]">
          <ArticleBody
            body={article.body}
            callout={<ProfileCallout profile={article.profile} />}
          />

          {/* Closing share line — honest, just a link to the canonical URL. */}
          <p className="mt-2 border-t border-[var(--norm-rule)] pt-6 text-sm text-[var(--norm-muted)]">
            Share this story:{' '}
            <a
              href={articleUrl(article)}
              className="font-mono underline-offset-4 hover:underline"
            >
              {articleUrl(article).replace(/^https?:\/\//, '')}
            </a>
          </p>
        </div>

        {/* Photo gallery sits outside the narrow column to use width. */}
        <div className="mx-auto max-w-5xl">
          <PhotoGallery
            photos={article.profile.photos}
            alt={article.profile.display_name}
          />
        </div>

        {/* Final CTA back to the personal site — second link to the
            subdomain on the page (intentional: the JSON-LD also points
            here). Plain anchor; no nofollow. */}
        <div className="mx-auto max-w-3xl border-y border-[var(--norm-rule)] py-6 text-center">
          <p className="norm-kicker">Continue reading</p>
          <p className="mt-2 font-serif text-xl">
            Visit{' '}
            <a
              href={personal}
              className="font-black text-[var(--norm-ink)] underline underline-offset-4 hover:text-[var(--norm-accent)]"
            >
              {article.profile.display_name}&rsquo;s personal site
            </a>
            .
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <SocialRow
            links={article.profile.social_links}
            name={article.profile.display_name}
          />
        </div>
      </article>

      <div className="mx-auto max-w-6xl px-6">
        <RelatedStories articles={related} />
      </div>
    </>
  )
}
