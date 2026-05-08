import type { Metadata } from 'next'
import { Source_Serif_4, Inter } from 'next/font/google'
import { SiteHeader } from '@/components/news/site-header'
import { SiteFooter } from '@/components/news/site-footer'
import './news.css'

// Editorial body + display serif. We weight 400/600/700/900 because the
// front page mixes display weights for the masthead and grid cards.
const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-norm-serif',
})

// Sans for chrome, dateline, captions. Plain and quiet.
const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-norm-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://thenorm.info'),
  title: { default: 'The Norm', template: '%s — The Norm' },
  description:
    'Profiles of emerging voices, builders, and people worth knowing.',
  applicationName: 'The Norm',
  authors: [{ name: 'The Norm Staff' }],
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': '/rss.xml',
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'The Norm',
    locale: 'en_US',
    url: 'https://thenorm.info',
  },
  twitter: { card: 'summary_large_image' },
}

export default function NewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${serif.variable} ${sans.variable} norm-root min-h-screen bg-[var(--norm-bg)] text-[var(--norm-ink)]`}
    >
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  )
}
