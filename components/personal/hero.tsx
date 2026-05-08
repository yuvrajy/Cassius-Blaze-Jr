import Image from 'next/image'
import type { ProfileWithAssets } from '@/lib/contracts/profile'
import { heroPhotoUrl } from './helpers'
import { SocialIcons } from './social-icons'

export function Hero({ profile }: { profile: ProfileWithAssets }) {
  const photo = heroPhotoUrl(profile.photos)
  return (
    <header className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-black">
      <div className="absolute inset-0 -z-10">
        {photo ? (
          <Image
            src={photo}
            alt={profile.display_name}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center brightness-90 saturate-90"
          />
        ) : (
          <div className="absolute inset-0 bg-black" aria-hidden />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(6,6,8,0.35)_45%,rgba(6,6,8,0.9)_80%,#060608_100%)]"
        />
      </div>

      <div className="flex justify-end px-6 pt-6 sm:px-12 sm:pt-8">
        <SocialIcons links={profile.social_links} />
      </div>

      <div className="mt-auto px-6 pb-16 pt-32 sm:px-12 sm:pb-20 lg:px-16 lg:pb-24">
        <div className="max-w-4xl">
          <p className="pn-sans text-[0.68rem] font-medium uppercase tracking-[0.35em] text-[#c9a84c] sm:text-xs">
            Official Site &nbsp;·&nbsp; {profile.subdomain}
          </p>
          <h1 className="pn-serif mt-5 text-[clamp(3.25rem,11vw,8.5rem)] font-light leading-[0.92] tracking-[-0.01em] text-[#f5f3ee] sm:mt-6">
            {renderName(profile.display_name)}
          </h1>
          {profile.tagline && (
            <p className="pn-serif mt-5 text-[clamp(1.05rem,2.4vw,1.6rem)] font-light italic leading-snug tracking-[0.04em] text-[#bbbbc4] sm:mt-6">
              {profile.tagline}
            </p>
          )}
          <div className="mt-8 h-px w-12 bg-[#c9a84c]" aria-hidden />
        </div>
      </div>
    </header>
  )
}

// Display name on two lines when the surname is short enough to read well —
// preserves the staircase composition from the deprecated reference.
function renderName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  const last = parts.slice(1).join(' ')
  return (
    <>
      <span className="block text-[#f5f3ee]">{parts[0]}</span>
      <span className="block text-[#c9a84c]">{last}</span>
    </>
  )
}
