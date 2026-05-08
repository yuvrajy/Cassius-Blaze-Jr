import type { PhotoRow } from '@/lib/types/db'
import { Photo } from '@/components/news/photo'

// Render the secondary photos for the article in a horizontal strip below
// the body. Skips the primary photo (already used as the hero).
export function PhotoGallery({
  photos,
  alt,
}: {
  photos: PhotoRow[]
  alt: string
}) {
  const secondaries = photos
    .filter((p) => !p.is_primary)
    .sort((a, b) => a.sort_order - b.sort_order)
  if (secondaries.length === 0) return null

  return (
    <section className="py-8">
      <p className="norm-kicker mb-4">More photographs</p>
      <div
        className={`grid gap-3 ${
          secondaries.length === 1
            ? 'grid-cols-1'
            : secondaries.length === 2
              ? 'grid-cols-2'
              : 'grid-cols-2 md:grid-cols-3'
        }`}
      >
        {secondaries.map((p) => (
          <Photo
            key={p.id}
            src={
              p.variants?.medium ??
              p.variants?.large ??
              p.variants?.original ??
              p.storage_path
            }
            alt={alt}
            className="aspect-[4/5]"
            sizes="(min-width: 768px) 33vw, 50vw"
          />
        ))}
      </div>
    </section>
  )
}
