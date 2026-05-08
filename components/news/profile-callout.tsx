import { profileUrls } from '@/lib/contracts/revalidation'
import type { ProfileWithAssets } from '@/lib/contracts/profile'

// "More about {name}" mid-article callout. This is the SEO link that
// passes authority to the customer's personal subdomain. It is rendered
// as a real internal-style cross-link, not a banner ad.
//
// rel is intentionally NOT "nofollow" — we WANT to pass link equity.
export function ProfileCallout({ profile }: { profile: ProfileWithAssets }) {
  const { personal, personalHost } = profileUrls(profile)
  const name = profile.display_name

  return (
    <aside className="norm-callout">
      <p className="norm-callout-label">More about {name}</p>
      <h3 className="mt-2 font-serif text-2xl font-black leading-tight">
        <a
          href={personal}
          className="text-[var(--norm-ink)] hover:text-[var(--norm-accent)] hover:underline"
        >
          Read {name}&rsquo;s personal site →
        </a>
      </h3>
      {profile.tagline ? (
        <p className="mt-2 font-serif text-base text-[var(--norm-muted)]">
          {profile.tagline}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-[var(--norm-muted)]">
        <span className="font-mono tracking-tight">{personalHost}</span>
      </p>
    </aside>
  )
}
