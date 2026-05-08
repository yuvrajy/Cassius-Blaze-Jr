import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  PencilLineIcon,
  NewspaperIcon,
  SearchIcon,
  CheckIcon,
  StarIcon,
} from 'lucide-react'

export const metadata = {
  title: 'getknown — make yourself findable on Google',
  description:
    'A real news article, a personal site, and the SEO setup it takes to rank for your own name — done in days, not years.',
}

const PARENT_DOMAIN = process.env.NEXT_PUBLIC_PARENT_DOMAIN ?? 'iam.bio'

export default function ServiceLandingPage() {
  return (
    <div className="bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <HowItWorks />
      <WhatYouGet />
      <Pricing />
      <Faq />
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-heading text-base font-semibold tracking-tight">
          getknown<span className="text-orange-600">.</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#what" className="hover:text-foreground">What you get</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <Button className="h-9 px-4" render={<Link href="/signup" />}>
          Get started
        </Button>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-50 via-background to-background" />
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
          findability, on demand
        </p>
        <h1 className="mt-5 max-w-4xl font-heading text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl sm:leading-[1.02]">
          Make yourself findable on Google in days,{' '}
          <span className="text-muted-foreground">not years.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          We publish a real news article about you, build a personal site at your
          name, and wire the SEO so search engines actually index you. No more
          scrolling past someone else when people Google your name.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button className="h-12 px-6 text-base" render={<Link href="/signup" />}>
            Get started — $49
          </Button>
          <Button
            variant="outline"
            className="h-12 px-6 text-base"
            render={<a href="#how" />}
          >
            How it works
          </Button>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon className="size-3.5" /> Live in under 7 days
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon className="size-3.5" /> Real journalism, not press release
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon className="size-3.5" /> Take it down anytime
          </span>
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    n: '01',
    icon: PencilLineIcon,
    title: 'Tell us about yourself.',
    body:
      'A short signup walks you through bio, photos, and the links you want shown. Takes about ten minutes.',
  },
  {
    n: '02',
    icon: NewspaperIcon,
    title: 'We publish your article and site.',
    body: `Our editors write a real news piece on thenorm.info and spin up a personal site at yourname.${PARENT_DOMAIN}. Cross-linked, indexed, and ready to crawl.`,
  },
  {
    n: '03',
    icon: SearchIcon,
    title: 'Google finds you within weeks.',
    body:
      'You start ranking for your own name. We monitor the indexing and tune metadata until you’re on page one.',
  },
]

function HowItWorks() {
  return (
    <section id="how" className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <SectionHeader eyebrow="How it works" title="Three steps. Done in a week." />
        <ol className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map(({ n, icon: Icon, title, body }) => (
            <li key={n} className="relative">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-orange-50 text-orange-700 ring-1 ring-orange-200/60">
                  <Icon className="size-4" />
                </div>
                <span className="font-mono text-xs tracking-widest text-muted-foreground">
                  {n}
                </span>
              </div>
              <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function WhatYouGet() {
  const items = [
    {
      title: 'A real news article on thenorm.info',
      body:
        'A staff-written feature about you on a working editorial publication — not a press release, not a paid placement page.',
    },
    {
      title: `A personal site at yourname.${PARENT_DOMAIN}`,
      body:
        'Clean, fast, mobile-friendly. Bio, photos, social links. The site Google likes to surface.',
    },
    {
      title: 'Full SEO setup',
      body:
        'Schema.org Person + Article markup, canonical tags, sitemap, OG images — wired correctly the first time.',
    },
    {
      title: 'A photo gallery',
      body:
        'Up to five portrait photos. We handle resizing, EXIF stripping, and the OG card.',
    },
    {
      title: 'Your social links',
      body:
        'Twitter, LinkedIn, GitHub, Instagram — surfaced on your site and inside the article so search engines know they’re you.',
    },
    {
      title: 'Optional bespoke domain',
      body:
        'Upgrade to a name like yourname.xyz that 301s to your site. Adds another high-authority signal.',
    },
  ]
  return (
    <section id="what" className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <SectionHeader
          eyebrow="What you get"
          title="A complete first page of search results."
        />
        <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {items.map(it => (
            <li key={it.title} className="flex gap-4">
              <CheckIcon className="mt-1 size-4 shrink-0 text-orange-600" />
              <div>
                <h3 className="font-heading text-base font-semibold tracking-tight">
                  {it.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {it.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <SectionHeader eyebrow="Pricing" title="Simple. Pay once, stay indexed." />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <PricingCard
            tier="Base"
            price="$49"
            cadence="one-time"
            blurb="Article + personal site at a subdomain we host."
            features={[
              'News article on thenorm.info',
              `Personal site at yourname.${PARENT_DOMAIN}`,
              'SEO + schema markup',
              'Photo gallery (up to 5)',
              'Social links',
              'Take down anytime',
            ]}
          />
          <PricingCard
            tier="Bespoke"
            price="$149"
            cadence="one-time"
            blurb="Everything in Base, plus your own domain."
            features={[
              'Everything in Base',
              'Custom domain (e.g. yourname.xyz)',
              '301 redirect to your site',
              'Domain registered + renewed for one year',
              'Priority indexing',
            ]}
            highlight
          />
        </div>
      </div>
    </section>
  )
}

function PricingCard({
  tier,
  price,
  cadence,
  blurb,
  features,
  highlight,
}: {
  tier: string
  price: string
  cadence: string
  blurb: string
  features: string[]
  highlight?: boolean
}) {
  return (
    <div
      className={
        'relative flex flex-col overflow-hidden rounded-2xl p-8 ring-1 ' +
        (highlight
          ? 'bg-foreground text-background ring-foreground'
          : 'bg-background text-foreground ring-border')
      }
    >
      {highlight && (
        <span className="absolute top-6 right-6 inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-300 ring-1 ring-orange-500/30">
          <StarIcon className="size-3" /> Recommended
        </span>
      )}
      <h3 className="font-heading text-xl font-semibold tracking-tight">{tier}</h3>
      <p className={'mt-1 text-sm ' + (highlight ? 'text-background/70' : 'text-muted-foreground')}>
        {blurb}
      </p>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-heading text-5xl font-semibold tracking-tight">{price}</span>
        <span className={'text-sm ' + (highlight ? 'text-background/70' : 'text-muted-foreground')}>
          {cadence}
        </span>
      </div>
      <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2">
            <CheckIcon
              className={
                'mt-0.5 size-4 shrink-0 ' +
                (highlight ? 'text-orange-300' : 'text-orange-600')
              }
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-10">
        <Button
          variant={highlight ? 'secondary' : 'default'}
          className="h-11 w-full px-5 text-sm"
          render={<Link href="/signup" />}
        >
          Choose {tier}
        </Button>
      </div>
    </div>
  )
}

const FAQ = [
  {
    q: 'Will I actually rank for my name?',
    a: 'Most people without a digital footprint rank within a few weeks once we publish. Common names take longer because we have to compete with existing public figures — that’s what the uniqueness check at signup is for.',
  },
  {
    q: 'What about my privacy?',
    a: 'You decide what goes on the page. We strip GPS data and other metadata from photos before upload, never publish your DOB or address, and let you take everything down at any time from your dashboard.',
  },
  {
    q: 'Can I take it down later?',
    a: 'Yes — one click from your dashboard removes the article, the personal site, and the search-engine signals. The takedown propagates within 24 hours.',
  },
  {
    q: 'What is the difference between Base and Bespoke?',
    a: `Base gives you a personal site at a subdomain we own (yourname.${PARENT_DOMAIN}). Bespoke adds a custom domain like yourname.xyz that we register on your behalf and 301 to the subdomain. Bespoke ranks slightly better because the standalone domain is a stronger trust signal.`,
  },
  {
    q: 'My name is shared with someone famous. Can I still sign up?',
    a: 'Maybe. During signup we run a uniqueness check against Google and Wikidata. If there’s a major collision (active politician, celebrity), we’ll suggest variations like adding a middle initial or a city. If you insist on the exact name, we’ll flag it for editorial review before publishing.',
  },
  {
    q: 'Do I need a Google account or anything else?',
    a: 'No. You enter your email at checkout and we email you a dashboard link. No passwords, no separate accounts.',
  },
]

function Faq() {
  return (
    <section id="faq" className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <SectionHeader eyebrow="FAQ" title="Questions, answered." />
        <dl className="mt-12 divide-y divide-border/60">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="py-6 first:pt-0 last:pb-0">
              <dt className="font-heading text-base font-semibold tracking-tight">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-orange-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-2xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-heading text-sm font-semibold tracking-tight">
          getknown<span className="text-orange-600">.</span>
        </p>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <a href="mailto:hello@getknown.com" className="hover:text-foreground">
            hello@getknown.com
          </a>
        </nav>
      </div>
    </footer>
  )
}
