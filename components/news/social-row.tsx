import { fullUrlFor } from '@/lib/contracts/profile'
import type { SocialLinkRow, SocialPlatform } from '@/lib/types/db'

const LABELS: Record<SocialPlatform, string> = {
  twitter: 'Twitter',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  email: 'Email',
  website: 'Website',
}

export function SocialRow({
  links,
  name,
}: {
  links: SocialLinkRow[]
  name: string
}) {
  if (!links.length) return null
  const sorted = [...links].sort((a, b) => a.sort_order - b.sort_order)
  return (
    <section className="border-y border-[var(--norm-rule)] py-6">
      <p className="norm-kicker mb-3">Find {name} elsewhere</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {sorted.map((link) => (
          <li key={link.id}>
            <a
              href={fullUrlFor(link)}
              className="font-serif text-base text-[var(--norm-ink)] underline-offset-4 hover:underline hover:text-[var(--norm-accent)]"
            >
              {LABELS[link.platform]}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
