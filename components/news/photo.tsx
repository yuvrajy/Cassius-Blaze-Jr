/* eslint-disable @next/next/no-img-element */

// Unstyled photo wrapper. We render an <img> rather than next/image so we
// don't need to whitelist the Supabase storage origin in next.config; if/when
// agent 1 adds remotePatterns we can swap to next/image inside this component.
// Falls back to a black placeholder div when no source is available.

export function Photo({
  src,
  alt,
  className = '',
  sizes,
  priority = false,
}: {
  src: string | null | undefined
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
}) {
  if (!src) {
    return (
      <div
        className={`norm-photo-placeholder overflow-hidden ${className}`}
        aria-label={alt}
        role="img"
      />
    )
  }
  return (
    <div className={`overflow-hidden bg-black ${className}`}>
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  )
}
