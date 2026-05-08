import { Mail, Globe } from 'lucide-react'
import type { SocialLinkRow, SocialPlatform } from '@/lib/types/db'
import { fullUrlFor } from '@/lib/contracts/profile'

// Brand glyphs aren't shipped in lucide-react; we render compact monochrome
// inline SVGs for the social platforms and use lucide for the generic ones.
function PlatformGlyph({ platform }: { platform: SocialPlatform }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true,
  } as const
  switch (platform) {
    case 'twitter':
      return (
        <svg {...common}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...common}>
          <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5ZM.22 8h4.56v14H.22V8Zm7.5 0h4.37v1.92h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.47 3.04 5.47 6.99V22h-4.56v-6.13c0-1.46-.03-3.34-2.04-3.34-2.04 0-2.36 1.6-2.36 3.24V22H7.72V8Z" />
        </svg>
      )
    case 'github':
      return (
        <svg {...common}>
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.1.79-.25.79-.55 0-.27-.01-.99-.02-1.94-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.97 10.97 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.12 3.04.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.79-.01 3.17 0 .31.21.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...common}>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.85 20.5a6.34 6.34 0 0 0 10.86-4.43V9.04a8.16 8.16 0 0 0 4.77 1.52V7.11a4.85 4.85 0 0 1-1.89-.42Z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...common}>
          <path d="M23.5 6.5a3 3 0 0 0-2.12-2.12C19.5 4 12 4 12 4s-7.5 0-9.38.38A3 3 0 0 0 .5 6.5C.13 8.38.13 12 .13 12s0 3.62.37 5.5a3 3 0 0 0 2.12 2.12C4.5 20 12 20 12 20s7.5 0 9.38-.38a3 3 0 0 0 2.12-2.12c.37-1.88.37-5.5.37-5.5s0-3.62-.37-5.5ZM9.75 15.5v-7l6.25 3.5-6.25 3.5Z" />
        </svg>
      )
    case 'email':
      return <Mail size={18} strokeWidth={1.6} aria-hidden />
    case 'website':
      return <Globe size={18} strokeWidth={1.6} aria-hidden />
  }
}

const platformLabel: Record<SocialPlatform, string> = {
  twitter: 'X / Twitter',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  email: 'Email',
  website: 'Website',
}

export function SocialIcons({
  links,
  className = '',
}: {
  links: SocialLinkRow[]
  className?: string
}) {
  if (!links.length) return null
  const ordered = [...links].sort((a, b) => a.sort_order - b.sort_order)
  return (
    <ul
      className={`flex items-center gap-3 sm:gap-4 ${className}`}
      aria-label="Find me elsewhere"
    >
      {ordered.map((link) => {
        const href = fullUrlFor({ platform: link.platform, value: link.value })
        const label = platformLabel[link.platform]
        const isMail = link.platform === 'email'
        return (
          <li key={link.id}>
            <a
              href={href}
              {...(!isMail && { target: '_blank', rel: 'noopener noreferrer me' })}
              aria-label={label}
              title={label}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#c9a84c]/25 text-[#c9a84c] transition hover:border-[#c9a84c] hover:bg-[#c9a84c]/10"
            >
              <PlatformGlyph platform={link.platform} />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
