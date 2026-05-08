import Image from 'next/image'
import type { PhotoRow } from '@/lib/types/db'
import { photoUrl } from './helpers'

export function PhotoGallery({
  photos,
  displayName,
}: {
  photos: PhotoRow[]
  displayName: string
}) {
  const secondary = photos
    .filter((p) => !p.is_primary)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5)

  if (!secondary.length) return null

  return (
    <section className="bg-[#060608] py-24 sm:py-32">
      <div className="mb-12 px-6 sm:mb-16 sm:px-12 lg:px-16">
        <p className="pn-sans text-[0.62rem] font-medium uppercase tracking-[0.4em] text-[#c9a84c]">
          Frames
        </p>
        <h2 className="pn-serif mt-4 text-[clamp(1.8rem,3.4vw,2.8rem)] font-light leading-[1.1] text-[#f5f3ee]">
          {displayName.split(/\s+/)[0]}, in motion.
        </h2>
        <div className="mt-6 h-px w-12 bg-[#c9a84c]" aria-hidden />
      </div>

      <div className="grid grid-cols-2 gap-[3px] sm:grid-cols-3 sm:auto-rows-[minmax(220px,1fr)] lg:grid-cols-3 lg:grid-rows-[420px_280px]">
        {secondary.map((photo, idx) => {
          const url = photoUrl(photo, 'medium')
          if (!url) return null
          const isFeature = idx === 0
          return (
            <div
              key={photo.id}
              className={[
                'relative overflow-hidden bg-black',
                isFeature
                  ? 'col-span-2 row-span-1 sm:col-span-2 sm:row-span-2 lg:col-span-1 lg:row-span-2'
                  : '',
              ].join(' ')}
            >
              <Image
                src={url}
                alt={`${displayName} — photograph`}
                fill
                sizes={
                  isFeature
                    ? '(min-width: 1024px) 33vw, (min-width: 640px) 66vw, 100vw'
                    : '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw'
                }
                className="object-cover object-center brightness-[0.92] saturate-[0.95] transition duration-500 hover:scale-[1.04] hover:brightness-100"
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
