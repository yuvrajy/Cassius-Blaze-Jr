import Link from 'next/link'
import type { Metadata } from 'next'
import { ArticleCard } from '@/components/news/article-card'
import { listLiveArticles } from '@/components/news/queries'

export const revalidate = 60

const PAGE_SIZE = 12

export const metadata: Metadata = {
  title: 'The Norm — Profiles of people worth knowing',
  description:
    'Profiles of emerging voices, builders, and people worth knowing. Long-form journalism on the people shaping what comes next.',
  openGraph: {
    title: 'The Norm — Profiles of people worth knowing',
    description:
      'Profiles of emerging voices, builders, and people worth knowing.',
    url: 'https://thenorm.info',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Norm',
    description:
      'Profiles of emerging voices, builders, and people worth knowing.',
  },
  alternates: { canonical: 'https://thenorm.info/' },
}

export default async function NewsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)
  const offset = (page - 1) * PAGE_SIZE
  const { articles, total } = await listLiveArticles({
    limit: PAGE_SIZE,
    offset,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (articles.length === 0 && page === 1) {
    return (
      <>
        <WebsiteJsonLd />
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="norm-kicker">The Norm</p>
          <h1 className="norm-headline-xl mt-4 text-4xl">
            New stories coming soon.
          </h1>
          <p className="mt-6 font-serif text-lg text-[var(--norm-muted)]">
            We&rsquo;re working on the first profiles. Check back shortly, or{' '}
            <Link href="/about" className="underline">
              read about The Norm
            </Link>
            .
          </p>
        </div>
      </>
    )
  }

  const isFirstPage = page === 1
  const [hero, ...rest] = articles

  let leadRow: typeof rest = []
  let grid: typeof rest = rest
  if (isFirstPage && rest.length > 0) {
    leadRow = rest.slice(0, 3)
    grid = rest.slice(3)
  }

  return (
    <>
      <WebsiteJsonLd />
      <div className="mx-auto max-w-6xl px-6">
        {isFirstPage && hero ? (
          <section className="border-b border-[var(--norm-rule)] py-10 md:py-14">
            <ArticleCard article={hero} variant="hero" />
          </section>
        ) : null}

        {leadRow.length > 0 ? (
          <section className="grid gap-x-8 gap-y-10 py-10 sm:grid-cols-2 lg:grid-cols-3">
            {leadRow.map((article) => (
              <ArticleCard key={article.id} article={article} variant="lead" />
            ))}
          </section>
        ) : null}

        {grid.length > 0 ? (
          <section className="border-t-2 border-[var(--norm-ink)] pt-8 pb-12">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl font-black">
                {isFirstPage ? 'More stories' : `Page ${page}`}
              </h2>
              <p className="norm-kicker">
                {total} {total === 1 ? 'story' : 'stories'}
              </p>
            </div>
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {grid.map((article) => (
                <ArticleCard key={article.id} article={article} variant="grid" />
              ))}
            </div>
          </section>
        ) : null}

        <Pagination page={page} totalPages={totalPages} />

        <section className="border-t border-[var(--norm-rule)] py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-2">
              <p className="norm-kicker">About The Norm</p>
              <h2 className="norm-headline-xl mt-3 text-2xl">
                An independent record of people worth knowing.
              </h2>
              <p className="mt-4 max-w-prose font-serif text-[var(--norm-ink)]">
                The Norm publishes long-form profiles of emerging voices,
                builders, and people whose work deserves a wider audience.
                Stories are reported by our staff and fact-checked before they
                run.{' '}
                <Link href="/about" className="underline">
                  More about us →
                </Link>
              </p>
            </div>
            <div className="md:pt-9">
              <p className="norm-kicker">Subscribe</p>
              <p className="mt-3 font-serif text-base text-[var(--norm-muted)]">
                Read every new story in your feed reader.
              </p>
              <Link
                href="/rss.xml"
                className="mt-3 inline-flex items-center gap-2 border-b border-[var(--norm-ink)] pb-0.5 font-serif text-[var(--norm-ink)] hover:text-[var(--norm-accent)]"
              >
                RSS feed →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

function Pagination({
  page,
  totalPages,
}: {
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null
  const prev = page > 1 ? `/?page=${page - 1}` : null
  const next = page < totalPages ? `/?page=${page + 1}` : null
  return (
    <nav
      className="flex items-center justify-between border-t border-[var(--norm-rule)] py-6"
      aria-label="Pagination"
    >
      {prev ? (
        <Link href={prev} className="norm-kicker hover:text-[var(--norm-ink)]">
          ← Newer stories
        </Link>
      ) : (
        <span />
      )}
      <span className="norm-kicker">
        Page {page} of {totalPages}
      </span>
      {next ? (
        <Link href={next} className="norm-kicker hover:text-[var(--norm-ink)]">
          Older stories →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}

function WebsiteJsonLd() {
  const json = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'The Norm',
    url: 'https://thenorm.info',
    description:
      'Profiles of emerging voices, builders, and people worth knowing.',
    publisher: {
      '@type': 'Organization',
      name: 'The Norm',
      url: 'https://thenorm.info',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://thenorm.info/?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}
