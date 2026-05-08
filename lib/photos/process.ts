import 'server-only'
import sharp from 'sharp'
import {
  moveDraftToLive,
  publicUrlFor,
  uploadVariant,
} from '@/lib/photos/storage'

// Photo processing pipeline. For every photo:
//   1. Move from draft/ to live/ (full-res `original` lands at the live path).
//   2. Re-strip EXIF (defense in depth — agent 2 strips client-side too).
//   3. Generate the variant set used by the renderer.
//   4. Upload variants to storage and return ABSOLUTE public URLs.
//
// We populate BOTH the names from the brief (hero/gallery/og/thumb) and the
// legacy aliases the foundation type expects (large/medium/original) so the
// `primaryPhotoUrl()` helper in lib/contracts/profile.ts keeps working
// without a contract patch.

export interface ProcessedPhoto {
  /** Storage key (relative path) of the full-res object. */
  storage_path: string
  /** All-absolute URL map written into photos.variants jsonb. */
  variants: Record<string, string>
}

export interface ProcessPhotoArgs {
  draftPath: string
  userId: string
  photoId: string
  isPrimary: boolean
}

export async function processPhoto(args: ProcessPhotoArgs): Promise<ProcessedPhoto> {
  const { livePath, bytes } = await moveDraftToLive({
    draftPath: args.draftPath,
    userId: args.userId,
    photoId: args.photoId,
  })

  const buf = Buffer.from(bytes)

  const heroPath = await renderAndUpload({
    bytes: buf,
    userId: args.userId,
    photoId: args.photoId,
    variant: 'hero',
    width: 1200,
    height: 800,
    quality: 85,
    format: 'webp',
  })
  const galleryPath = await renderAndUpload({
    bytes: buf,
    userId: args.userId,
    photoId: args.photoId,
    variant: 'gallery',
    width: 800,
    height: 800,
    quality: 85,
    format: 'webp',
  })
  const ogPath = await renderAndUpload({
    bytes: buf,
    userId: args.userId,
    photoId: args.photoId,
    variant: 'og',
    width: 1200,
    height: 630,
    quality: 85,
    format: 'webp',
  })
  const thumbPath = await renderAndUpload({
    bytes: buf,
    userId: args.userId,
    photoId: args.photoId,
    variant: 'thumb',
    width: 400,
    height: 400,
    quality: 80,
    format: 'webp',
  })

  // Always write a stripped JPEG copy as the canonical "original" URL so
  // the renderer can serve a no-EXIF master without crawling the bucket.
  const strippedOriginalPath = await renderAndUpload({
    bytes: buf,
    userId: args.userId,
    photoId: args.photoId,
    variant: 'original',
    quality: 92,
    format: 'jpeg',
    keepAspect: true,
  })

  const variants: Record<string, string> = {
    hero: publicUrlFor(heroPath),
    gallery: publicUrlFor(galleryPath),
    og: publicUrlFor(ogPath),
    thumb: publicUrlFor(thumbPath),
    // Aliases for `primaryPhotoUrl()` (PhotoVariants in lib/types/db.ts).
    large: publicUrlFor(heroPath),
    medium: publicUrlFor(galleryPath),
    original: publicUrlFor(strippedOriginalPath),
  }

  if (args.isPrimary) {
    const fav32 = await renderAndUpload({
      bytes: buf,
      userId: args.userId,
      photoId: args.photoId,
      variant: 'favicon32',
      width: 32,
      height: 32,
      format: 'png',
    })
    const apple = await renderAndUpload({
      bytes: buf,
      userId: args.userId,
      photoId: args.photoId,
      variant: 'apple_touch',
      width: 180,
      height: 180,
      format: 'png',
    })
    variants.favicon32 = publicUrlFor(fav32)
    variants.apple_touch = publicUrlFor(apple)
  }

  return { storage_path: livePath, variants }
}

interface RenderArgs {
  bytes: Buffer
  userId: string
  photoId: string
  variant: string
  width?: number
  height?: number
  quality?: number
  format: 'webp' | 'png' | 'jpeg'
  keepAspect?: boolean
}

async function renderAndUpload(args: RenderArgs): Promise<string> {
  let pipeline = sharp(args.bytes, { failOn: 'truncated' }).rotate()
  // Re-strip EXIF / IPTC / XMP / ICC. `withMetadata()` re-attaches; omitting
  // it (default) drops everything except orientation already applied above.
  if (args.width && args.height) {
    pipeline = pipeline.resize({
      width: args.width,
      height: args.height,
      fit: args.keepAspect ? 'inside' : 'cover',
      position: 'attention',
    })
  } else if (args.keepAspect) {
    // No resize — full-res, just metadata stripped.
  }

  let out: Buffer
  let ext: string
  let contentType: string
  if (args.format === 'webp') {
    out = await pipeline.webp({ quality: args.quality ?? 85 }).toBuffer()
    ext = 'webp'
    contentType = 'image/webp'
  } else if (args.format === 'png') {
    out = await pipeline.png().toBuffer()
    ext = 'png'
    contentType = 'image/png'
  } else {
    out = await pipeline.jpeg({ quality: args.quality ?? 90, mozjpeg: true }).toBuffer()
    ext = 'jpg'
    contentType = 'image/jpeg'
  }

  return uploadVariant({
    userId: args.userId,
    photoId: args.photoId,
    variant: args.variant,
    ext,
    bytes: out,
    contentType,
  })
}
