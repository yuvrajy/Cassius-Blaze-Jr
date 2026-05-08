import type { ProfileWithAssets } from '@/lib/contracts/profile'
import { fullUrlFor } from '@/lib/contracts/profile'
import { firstSentence, heroPhotoUrl, parentDomain } from './helpers'

// Schema.org Person markup. The `sameAs` array is the highest-leverage SEO
// field on the personal site: it tells Google's Knowledge Graph that the
// same entity owns each linked profile, which is what unifies the result
// pages on a vanity-name search.
export function PersonJsonLd({ profile }: { profile: ProfileWithAssets }) {
  const subdomain = profile.subdomain
  const url = `https://${subdomain}.${parentDomain()}`
  const sameAs = profile.social_links
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => fullUrlFor({ platform: link.platform, value: link.value }))

  const image = heroPhotoUrl(profile.photos)

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.display_name,
    description: profile.tagline?.trim() || firstSentence(profile.bio),
    url,
  }
  if (image) data.image = image
  if (sameAs.length) data.sameAs = sameAs
  if (profile.bespoke_domain) {
    data.mainEntityOfPage = `https://${profile.bespoke_domain}`
  }

  return (
    <script
      type="application/ld+json"
      // JSON.stringify already escapes quotes; the `</` sequence is what we
      // need to guard against — split it across the string literal.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
