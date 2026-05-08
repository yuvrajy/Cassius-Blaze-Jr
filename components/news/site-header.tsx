import Link from 'next/link'

const FORMAT_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function SiteHeader() {
  // Render the dateline server-side at request time. It updates on each
  // ISR revalidation; precise to the day is good enough for a masthead.
  const today = FORMAT_DATE.format(new Date())

  return (
    <header className="border-b border-[var(--norm-rule)] bg-[var(--norm-bg)]">
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-6 text-[11px] uppercase tracking-[0.18em] text-[var(--norm-muted)]">
        <span>{today}</span>
        <nav className="flex items-center gap-5">
          <Link href="/" className="hover:text-[var(--norm-ink)]">
            Home
          </Link>
          <Link href="/about" className="hover:text-[var(--norm-ink)]">
            About
          </Link>
          <Link href="/rss.xml" className="hover:text-[var(--norm-ink)]">
            RSS
          </Link>
        </nav>
      </div>
      <div className="border-t border-[var(--norm-rule)]">
        <div className="mx-auto max-w-6xl px-6 py-7 text-center">
          <Link
            href="/"
            className="font-serif text-4xl font-black tracking-tight text-[var(--norm-ink)] sm:text-5xl"
            style={{ fontVariant: 'small-caps', letterSpacing: '0.02em' }}
          >
            The Norm
          </Link>
          <p className="mt-2 font-serif text-xs italic text-[var(--norm-muted)]">
            Emerging voices, builders, and people worth knowing.
          </p>
        </div>
      </div>
      <div className="border-t border-b border-[var(--norm-rule)]">
        <div className="mx-auto max-w-6xl px-6 py-2 text-center text-[11px] uppercase tracking-[0.22em] text-[var(--norm-muted)]">
          <span className="mx-2">Profiles</span>
          <span className="opacity-40">·</span>
          <span className="mx-2">Builders</span>
          <span className="opacity-40">·</span>
          <span className="mx-2">Culture</span>
          <span className="opacity-40">·</span>
          <span className="mx-2">Ideas</span>
        </div>
      </div>
    </header>
  )
}
