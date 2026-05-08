import type { Metadata } from 'next'
import Link from 'next/link'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'About — The Norm',
  description:
    'The Norm publishes long-form profiles of emerging voices, builders, and people worth knowing. Independent, fact-checked, reader-supported.',
  alternates: { canonical: 'https://thenorm.info/about' },
  openGraph: {
    title: 'About — The Norm',
    description:
      'The Norm publishes long-form profiles of emerging voices, builders, and people worth knowing.',
    url: 'https://thenorm.info/about',
    type: 'website',
    siteName: 'The Norm',
  },
}

export default function AboutPage() {
  return (
    <>
      <OrganizationJsonLd />
      <article className="mx-auto max-w-3xl px-6 py-16">
        <header className="border-b border-[var(--norm-rule)] pb-6">
          <p className="norm-kicker">About</p>
          <h1 className="norm-headline-xl mt-3 text-4xl sm:text-5xl">
            The Norm is a profile magazine.
          </h1>
        </header>

        <div className="norm-prose mt-10">
          <p>
            The Norm publishes long-form profiles of emerging voices,
            builders, founders, artists, and operators &mdash; the people
            whose work is shaping what comes next, even when it isn&rsquo;t
            yet showing up in the broader news cycle. Our brief is simple:
            tell the story of the person, accurately, in a form that holds
            up to a careful read.
          </p>

          <p>
            We are independent and reader-supported. Stories are written and
            reported by The Norm staff, fact-checked before they run, and
            updated when new information warrants. Subjects do not pay
            editors; subjects do not see drafts; quotes are confirmed in
            writing. When we make a mistake we say so, and we keep a public
            record of every correction at the foot of the article.
          </p>

          <p>
            We focus on people, not press releases. A profile in The Norm is
            built around primary sources &mdash; interviews with the
            subject, with people who have worked with them, with people
            whose lives they have changed. The work is slow on purpose. We
            would rather publish twelve stories a year worth re-reading than
            twelve hundred worth a single click.
          </p>

          <p>
            We accept pitches. If you would like us to consider profiling
            someone &mdash; or you would like to be considered yourself
            &mdash; the simplest route is through our partner program at{' '}
            <a
              href="https://getknown.com"
              className="underline underline-offset-2 hover:text-[var(--norm-accent)]"
            >
              getknown.com
            </a>
            , which handles introductions, fact-checking pre-work, and
            consent. Cold pitches are also welcome at{' '}
            <a
              href="mailto:editors@thenorm.info"
              className="underline underline-offset-2 hover:text-[var(--norm-accent)]"
            >
              editors@thenorm.info
            </a>
            ; we read every one, and we respond when we can run with it.
          </p>

          <p>
            If you would prefer to read every new story in your feed reader,
            our <Link href="/rss.xml" className="underline">RSS feed</Link>{' '}
            updates within minutes of publication. Browse the full back
            catalogue from the <Link href="/" className="underline">homepage</Link>.
          </p>
        </div>

        <div className="mt-12 border-t border-[var(--norm-rule)] pt-8">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="norm-kicker">Founded</dt>
              <dd className="mt-1 font-serif text-base">2025</dd>
            </div>
            <div>
              <dt className="norm-kicker">Headquarters</dt>
              <dd className="mt-1 font-serif text-base">Independent &mdash; online</dd>
            </div>
            <div>
              <dt className="norm-kicker">Editorial</dt>
              <dd className="mt-1 font-serif text-base">
                <a
                  href="mailto:editors@thenorm.info"
                  className="underline-offset-2 hover:underline"
                >
                  editors@thenorm.info
                </a>
              </dd>
            </div>
            <div>
              <dt className="norm-kicker">Corrections</dt>
              <dd className="mt-1 font-serif text-base">
                <a
                  href="mailto:corrections@thenorm.info"
                  className="underline-offset-2 hover:underline"
                >
                  corrections@thenorm.info
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </article>
    </>
  )
}

function OrganizationJsonLd() {
  const json = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: 'The Norm',
    url: 'https://thenorm.info',
    logo: {
      '@type': 'ImageObject',
      url: 'https://thenorm.info/icon.png',
    },
    email: 'editors@thenorm.info',
    description:
      'The Norm publishes long-form profiles of emerging voices, builders, and people worth knowing.',
    foundingDate: '2025',
    diversityPolicy: 'https://thenorm.info/about',
    ethicsPolicy: 'https://thenorm.info/about',
    correctionsPolicy: 'mailto:corrections@thenorm.info',
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}
