import Link from 'next/link'

export function SiteFooter() {
  const year = new Date().getFullYear()
  // The marketing site (where T&Cs live) is on an env-configurable hostname.
  const serviceDomain =
    process.env.NEXT_PUBLIC_SERVICE_DOMAIN ?? 'getknown.com'
  return (
    <footer className="mt-24 border-t border-[var(--norm-rule)] bg-[var(--norm-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p
              className="font-serif text-2xl font-black text-[var(--norm-ink)]"
              style={{ fontVariant: 'small-caps', letterSpacing: '0.02em' }}
            >
              The Norm
            </p>
            <p className="mt-1 font-serif text-xs italic text-[var(--norm-muted)]">
              © {year} The Norm. All rights reserved.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.18em] text-[var(--norm-muted)]">
            <Link href="/" className="hover:text-[var(--norm-ink)]">
              Home
            </Link>
            <Link href="/about" className="hover:text-[var(--norm-ink)]">
              About
            </Link>
            <Link href="/rss.xml" className="hover:text-[var(--norm-ink)]">
              RSS
            </Link>
            <Link href="/sitemap.xml" className="hover:text-[var(--norm-ink)]">
              Sitemap
            </Link>
            <a
              href={`https://${serviceDomain}/terms`}
              className="hover:text-[var(--norm-ink)]"
            >
              Terms
            </a>
            <a
              href="mailto:editors@thenorm.info"
              className="hover:text-[var(--norm-ink)]"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
