import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Photo storage helpers. The bucket layout is:
//
//   draft/{tmp_session_id}/{photo_id}.{ext}     ← uploaded by browser pre-payment
//   {user_id}/{photo_id}/{variant}.{ext}        ← live, post-payment
//
// (Per supabase/storage.sql the first path segment is the RLS anchor: it
// must equal auth.uid() for owner writes. The draft/ prefix is service-role
// only; the workflow moves objects out of it after payment.)

const BUCKET = 'photos'

export interface MoveDraftToLiveArgs {
  draftPath: string
  userId: string
  photoId: string
}

// Move a draft object to the live path. The original (full-resolution)
// object is stored at `{user_id}/{photo_id}/original.{ext}`. Sharp variants
// are written separately by lib/photos/process.ts.
export async function moveDraftToLive(args: MoveDraftToLiveArgs): Promise<{
  livePath: string
  bytes: ArrayBuffer
  contentType: string
}> {
  const admin = createAdminClient()
  const { data: file, error: dlErr } = await admin.storage
    .from(BUCKET)
    .download(args.draftPath)
  if (dlErr || !file) throw new Error(`download draft failed: ${dlErr?.message}`)

  const ext = extFor(args.draftPath)
  const livePath = `${args.userId}/${args.photoId}/original.${ext}`
  const bytes = await file.arrayBuffer()
  const contentType = file.type || guessContentType(ext)

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(livePath, bytes, { contentType, upsert: true })
  if (upErr) throw new Error(`upload live failed: ${upErr.message}`)

  // Delete the source. Best-effort — leaving a draft behind is harmless and
  // agent 7's cron sweeps the draft prefix anyway.
  await admin.storage.from(BUCKET).remove([args.draftPath])

  return { livePath, bytes, contentType }
}

export async function uploadVariant(args: {
  userId: string
  photoId: string
  variant: string
  ext: string
  bytes: Buffer | Uint8Array
  contentType: string
}): Promise<string> {
  const admin = createAdminClient()
  const path = `${args.userId}/${args.photoId}/${args.variant}.${args.ext}`
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, args.bytes, { contentType: args.contentType, upsert: true })
  if (error) throw new Error(`upload ${args.variant} failed: ${error.message}`)
  return path
}

export function publicUrlFor(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path}`
}

export async function deleteAllForPhoto(args: {
  userId: string
  photoId: string
}): Promise<void> {
  const admin = createAdminClient()
  const prefix = `${args.userId}/${args.photoId}`
  const { data: list } = await admin.storage.from(BUCKET).list(prefix)
  if (!list?.length) return
  await admin.storage
    .from(BUCKET)
    .remove(list.map((o) => `${prefix}/${o.name}`))
}

function extFor(path: string): string {
  const m = path.match(/\.([a-z0-9]+)$/i)
  return (m?.[1] ?? 'jpg').toLowerCase()
}

function guessContentType(ext: string): string {
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'heic':
      return 'image/heic'
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg'
  }
}
