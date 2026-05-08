import type { PhotoRow, PhotoVariants } from '@/lib/types/db'

export function parentDomain(): string {
  return process.env.NEXT_PUBLIC_PARENT_DOMAIN ?? 'iam.bio'
}

export function serviceDomain(): string {
  return process.env.NEXT_PUBLIC_SERVICE_DOMAIN ?? 'getknown.com'
}

export function hubDomain(): string {
  return process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'thenorm.info'
}

// Resolve a photo storage_path to a public URL. If the input already looks
// like an absolute URL, pass it through; otherwise build the Supabase public
// bucket URL. Returns null if neither input nor SUPABASE_URL is available.
export function resolvePhotoUrl(input: string | null | undefined): string | null {
  if (!input) return null
  if (/^https?:\/\//i.test(input)) return input
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  const cleaned = input.replace(/^\/+/, '')
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/photos/${cleaned}`
}

// Pick the right URL for a single photo, preferring a given variant. Falls
// through medium → large → original → storage_path. Always returns a fully
// public URL or null.
export function photoUrl(
  photo: PhotoRow | undefined | null,
  prefer: keyof PhotoVariants = 'medium',
): string | null {
  if (!photo) return null
  const v: PhotoVariants = photo.variants ?? {}
  const candidate =
    v[prefer] ?? v.large ?? v.medium ?? v.original ?? v.thumb ?? photo.storage_path
  return resolvePhotoUrl(candidate)
}

// Largest publicly served version of the primary photo — used for hero,
// JSON-LD `image`, and the OG card. Falls through large → medium → original.
export function heroPhotoUrl(photos: PhotoRow[]): string | null {
  const primary = photos.find((p) => p.is_primary) ?? photos[0]
  return photoUrl(primary, 'large')
}

// First sentence of a bio, for the Person.description JSON-LD field when no
// tagline is set. Trimmed to ~200 chars so search engines see something
// substantive but not the whole essay.
export function firstSentence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^[^.!?]+[.!?]/)
  const sentence = match ? match[0] : trimmed
  return sentence.length > 200 ? `${sentence.slice(0, 197).trimEnd()}…` : sentence
}

// Best-effort split of a display name into first / last for OpenGraph
// `profile.firstName` / `profile.lastName`. Single-word names yield only
// firstName.
export function splitDisplayName(name: string): { firstName: string; lastName?: string } {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0] }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

// Truncate text to N chars for meta descriptions, breaking on word boundaries.
export function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= max) return collapsed
  const cut = collapsed.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`
}
