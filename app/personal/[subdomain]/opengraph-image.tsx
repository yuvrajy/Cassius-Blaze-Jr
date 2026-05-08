import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import {
  parentDomain,
  resolvePhotoUrl,
} from '@/components/personal/helpers'
import type { PhotoRow, PhotoVariants } from '@/lib/types/db'

export const alt = 'Personal site'
export const size = { width: 1200, height: 630 } as const
export const contentType = 'image/png'
// Default Node runtime: the supabase ssr helper relies on `cookies()` which
// works in both runtimes, but the personal-site fetch path is already
// covered by ISR (page-level `revalidate = 60`) so the latency win of edge
// is marginal compared to the operational simplicity of Node here.

interface OgPayload {
  display_name: string
  tagline: string | null
  subdomain: string
  photo: string | null
}

type OgFetchRow = {
  subdomain: string
  display_name: string
  tagline: string | null
  photos:
    | Array<Pick<PhotoRow, 'storage_path' | 'variants' | 'is_primary' | 'sort_order'>>
    | null
}

async function loadPayload(subdomain: string): Promise<OgPayload | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('subdomain, display_name, tagline, photos(storage_path, variants, is_primary, sort_order)')
    .eq('subdomain', subdomain)
    .eq('status', 'live')
    .maybeSingle()
  if (!data) return null

  const row = data as unknown as OgFetchRow
  const photos = row.photos ?? []
  const primary = photos.find((p) => p.is_primary) ?? photos[0]
  const variants: PhotoVariants = primary?.variants ?? {}
  const photo = resolvePhotoUrl(
    variants.large ?? variants.medium ?? variants.original ?? primary?.storage_path,
  )

  return {
    subdomain: row.subdomain,
    display_name: row.display_name,
    tagline: row.tagline ?? null,
    photo,
  }
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain: paramSubdomain } = await params
  const payload = await loadPayload(paramSubdomain)
  const parent = parentDomain()

  if (!payload) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#060608',
            color: '#f5f3ee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Georgia, serif',
            fontSize: 56,
            letterSpacing: -1,
          }}
        >
          Site not found
        </div>
      ),
      size,
    )
  }

  const { display_name, tagline, subdomain, photo } = payload
  const nameParts = display_name.trim().split(/\s+/)
  const firstLine = nameParts[0]
  const restLine = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#060608',
          color: '#f5f3ee',
          position: 'relative',
        }}
      >
        {photo && (
          <img
            src={photo}
            alt=""
            width={620}
            height={630}
            style={{
              width: 620,
              height: 630,
              objectFit: 'cover',
              objectPosition: 'center',
              filter: 'brightness(0.85) saturate(0.9)',
            }}
          />
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(6,6,8,0) 0%, rgba(6,6,8,0.6) 45%, #060608 60%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 640,
            padding: '64px 60px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 16,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#c9a84c',
              fontWeight: 600,
              marginBottom: 28,
            }}
          >
            Official Site
          </div>
          <div
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 88,
              lineHeight: 0.95,
              fontWeight: 400,
              letterSpacing: -1,
              color: '#f5f3ee',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>{firstLine}</span>
            {restLine && <span style={{ color: '#c9a84c' }}>{restLine}</span>}
          </div>
          <div
            style={{
              width: 56,
              height: 2,
              background: '#c9a84c',
              marginTop: 32,
              marginBottom: 32,
            }}
          />
          {tagline && (
            <div
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontStyle: 'italic',
                fontSize: 28,
                lineHeight: 1.35,
                color: '#bbbbc4',
                maxWidth: 520,
                display: 'flex',
              }}
            >
              {tagline}
            </div>
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: 40,
            fontSize: 14,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#8a8a96',
            display: 'flex',
          }}
        >
          {subdomain}.{parent}
        </div>
      </div>
    ),
    size,
  )
}
