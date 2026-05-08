import { fullUrlFor, primaryPhotoUrl } from '@/lib/contracts/profile'
import type { ArticleWithProfile } from '@/lib/contracts/profile'
import { articleUrl, profileUrls } from '@/lib/contracts/revalidation'

// schema.org NewsArticle for one published article. The most valuable field
// here is `about.sameAs` — that array is what builds the Knowledge Graph
// entity for the subject of the article and is the whole reason this site
// exists. Keep it accurate, prune empties, and never invent URLs.
export function NewsArticleJsonLd({
  article,
}: {
  article: ArticleWithProfile
}) {
  const canonical = articleUrl(article)
  const photoUrl = primaryPhotoUrl(article.profile)
  const { personal } = profileUrls(article.profile)

  const sameAs = article.profile.social_links
    .map((l) => fullUrlFor(l))
    .filter((u) => u && !u.startsWith('mailto:'))

  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.headline,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: {
      '@type': 'Person',
      name: article.author_name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'The Norm',
      url: 'https://thenorm.info',
      logo: {
        '@type': 'ImageObject',
        url: 'https://thenorm.info/icon.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
    about: {
      '@type': 'Person',
      name: article.profile.display_name,
      url: personal,
      ...(photoUrl ? { image: photoUrl } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
  }

  if (article.subheadline) {
    json.description = article.subheadline
  }
  if (photoUrl) {
    json.image = [photoUrl]
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}
