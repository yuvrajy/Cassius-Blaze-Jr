'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloudIcon, Loader2Icon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024
const MIN_DIM = 600

export type UploadedPhoto = {
  photo_uuid: string
  storage_path: string
  preview_url: string
  width: number
  height: number
}

export type UploadError = { file: string; message: string }

// Re-encodes the file via canvas to a fresh JPEG blob. This drops every EXIF
// field (including GPS) without us having to parse the marker segments — the
// browser-native re-encode just doesn't carry them across.
async function stripExifViaCanvas(file: File): Promise<{
  blob: Blob
  width: number
  height: number
}> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Could not decode image'))
      i.src = url
    })
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (w < MIN_DIM || h < MIN_DIM) {
      throw new Error(`Image is too small (${w}×${h}). Minimum ${MIN_DIM}×${MIN_DIM}.`)
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')
    ctx.drawImage(img, 0, 0)
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Encode failed'))),
        'image/jpeg',
        0.92,
      )
    })
    return { blob, width: w, height: h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function PhotoDropzone({
  userId,
  remainingSlots,
  onUploaded,
  onError,
}: {
  userId: string
  remainingSlots: number
  onUploaded: (p: UploadedPhoto) => void
  onError: (e: UploadError) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [drag, setDrag] = useState(false)

  const ingest = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).slice(0, remainingSlots)
      if (arr.length === 0) return
      setBusy(b => b + arr.length)
      const supabase = createClient()
      try {
        for (const file of arr) {
          try {
            // HEIC/HEIF can't be decoded in most browsers — surface a clear
            // message instead of letting Image.onerror fire mysteriously.
            const isHeic =
              /\.heic$|\.heif$/i.test(file.name) ||
              file.type === 'image/heic' ||
              file.type === 'image/heif'
            if (isHeic) {
              throw new Error(
                'HEIC files aren\'t supported here — re-export as JPEG and try again.',
              )
            }
            if (!ACCEPTED.includes(file.type)) {
              throw new Error(`Unsupported type: ${file.type || 'unknown'}.`)
            }
            if (file.size > MAX_BYTES) {
              throw new Error(`File is over 10 MB.`)
            }
            const { blob, width, height } = await stripExifViaCanvas(file)
            const photo_uuid = crypto.randomUUID()
            // Path scheme: {user_id}/draft/{photo_uuid}.jpg.
            // The leading {user_id} segment satisfies the storage RLS policy
            // (auth.uid() = first folder). Agent 6 moves objects out of the
            // /draft/ prefix once the profile is paid + finalized.
            const storage_path = `${userId}/draft/${photo_uuid}.jpg`
            const { error } = await supabase.storage
              .from('photos')
              .upload(storage_path, blob, {
                contentType: 'image/jpeg',
                upsert: false,
              })
            if (error) throw new Error(error.message)
            const { data } = supabase.storage
              .from('photos')
              .getPublicUrl(storage_path)
            onUploaded({
              photo_uuid,
              storage_path,
              preview_url: data.publicUrl,
              width,
              height,
            })
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Upload failed.'
            onError({ file: file.name, message: msg })
          } finally {
            setBusy(b => b - 1)
          }
        }
      } finally {
        // setBusy already managed per-file
      }
    },
    [remainingSlots, userId, onUploaded, onError],
  )

  if (remainingSlots <= 0) return null

  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault()
        setDrag(false)
        if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files)
      }}
      className={
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ' +
        (drag
          ? 'border-orange-400 bg-orange-50/60'
          : 'border-border bg-muted/30 hover:bg-muted/50')
      }
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) ingest(e.target.files)
          e.target.value = ''
        }}
      />
      {busy > 0 ? (
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      ) : (
        <UploadCloudIcon className="size-6 text-muted-foreground" />
      )}
      <p className="mt-3 text-sm font-medium">
        {busy > 0
          ? `Uploading ${busy}…`
          : 'Drop photos here, or click to choose'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        JPG, PNG, or WebP · min 600×600 · max 10MB · {remainingSlots}{' '}
        slot{remainingSlots === 1 ? '' : 's'} left
      </p>
    </div>
  )
}

export async function deletePhotoFromStorage(storage_path: string): Promise<void> {
  const supabase = createClient()
  await supabase.storage.from('photos').remove([storage_path])
}
