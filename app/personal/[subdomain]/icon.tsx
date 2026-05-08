import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { resolvePhotoUrl } from '@/components/personal/helpers'
import type { PhotoRow, PhotoVariants } from '@/lib/types/db'

export const size = { width: 64, height: 64 } as const
export const contentType = 'image/png'

// Tiny dynamic favicon built from the primary photo. We crop to a square,
// soften the edges, and let next/og rasterize. Fallback is a gold initial
// on the brand black if no photo exists or the profile isn't live.
export default async function Icon({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('display_name, photos(storage_path, variants, is_primary, sort_order)')
    .eq('subdomain', subdomain)
    .eq('status', 'live')
    .maybeSingle()

  type IconFetchRow = {
    display_name: string
    photos:
      | Array<Pick<PhotoRow, 'storage_path' | 'variants' | 'is_primary' | 'sort_order'>>
      | null
  }
  const row = data as unknown as IconFetchRow | null
  const photos = row?.photos ?? []
  const primary = photos.find((p) => p.is_primary) ?? photos[0]
  const variants: PhotoVariants = primary?.variants ?? {}
  const photo = resolvePhotoUrl(
    variants.thumb ?? variants.medium ?? variants.large ?? primary?.storage_path,
  )

  const initial = (row?.display_name ?? subdomain).trim().charAt(0).toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060608',
          color: '#c9a84c',
          overflow: 'hidden',
        }}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            width={64}
            height={64}
            style={{ width: 64, height: 64, objectFit: 'cover', objectPosition: 'center' }}
          />
        ) : (
          <span
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 42,
              fontWeight: 600,
            }}
          >
            {initial}
          </span>
        )}
      </div>
    ),
    size,
  )
}
