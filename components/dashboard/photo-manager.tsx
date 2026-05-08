'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { StarIcon, Trash2Icon, UploadCloudIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  addPhoto,
  deletePhoto,
  reorderPhotos,
  setPrimary,
} from '@/app/service/dashboard/photos/actions'

const MAX = 5

type PhotoCard = {
  id: string
  is_primary: boolean
  sort_order: number
  storage_path: string
  preview_url: string
}

export function PhotoManager({
  profileId,
  initialPhotos,
}: {
  profileId: string
  initialPhotos: PhotoCard[]
}) {
  void profileId
  const router = useRouter()
  const [photos, setPhotos] = useState(initialPhotos)
  const [pending, start] = useTransition()
  const [consent, setConsent] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  useEffect(() => {
    setPhotos(initialPhotos)
  }, [initialPhotos])

  async function onPickFile(file: File) {
    if (!consent) {
      toast.error('Please confirm the consent checkbox first.')
      return
    }
    if (photos.length >= MAX) {
      toast.error('You can have at most 5 photos.')
      return
    }
    setUploading(true)
    try {
      const stripped = await stripExif(file)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Sign-in expired. Refresh the page.')
        return
      }
      const ext = guessExt(stripped.type) ?? 'jpg'
      const storage_path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(storage_path, stripped, { contentType: stripped.type })
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`)
        return
      }
      const res = await addPhoto({
        storage_path,
        consent_attested: true,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Photo uploaded — moderation will run shortly.')
      router.refresh()
    } catch (err) {
      console.error('[photo upload]', err)
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = photos.findIndex((p) => p.id === active.id)
    const newIdx = photos.findIndex((p) => p.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(photos, oldIdx, newIdx)
    setPhotos(next)
    start(async () => {
      const res = await reorderPhotos({ ids: next.map((p) => p.id) })
      if (!res.ok) {
        toast.error(res.error)
        router.refresh()
      }
    })
  }

  function onSetPrimary(id: string) {
    setPhotos((ps) => ps.map((p) => ({ ...p, is_primary: p.id === id })))
    start(async () => {
      const res = await setPrimary(id)
      if (!res.ok) {
        toast.error(res.error)
        router.refresh()
      }
    })
  }

  function onDelete(id: string) {
    setPhotos((ps) => ps.filter((p) => p.id !== id))
    start(async () => {
      const res = await deletePhoto(id)
      if (!res.ok) {
        toast.error(res.error)
        router.refresh()
        return
      }
      toast.success('Photo deleted')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={consent}
              onCheckedChange={(c) => setConsent(c === true)}
            />
            <span>
              I confirm I have the right to publish this photo and the
              subject consents to it being shown publicly.
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onPickFile(f)
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={!consent || photos.length >= MAX || uploading}
              onClick={() => fileInput.current?.click()}
            >
              <UploadCloudIcon />
              {uploading ? 'Uploading…' : 'Upload photo'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {photos.length} / {MAX} photos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            JPEG / PNG / WebP. EXIF data is stripped client-side before
            upload.
          </p>
        </div>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={photos.map((p) => p.id)}
            strategy={rectSortingStrategy}
          >
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((p) => (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  onSetPrimary={() => onSetPrimary(p.id)}
                  onDelete={() => onDelete(p.id)}
                  disabled={pending}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function PhotoTile({
  photo,
  onSetPrimary,
  onDelete,
  disabled,
}: {
  photo: PhotoCard
  onSetPrimary: () => void
  onDelete: () => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="group relative overflow-hidden rounded-lg border border-border/70 bg-muted"
    >
      <button
        type="button"
        className="block aspect-square w-full cursor-grab"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.preview_url}
          alt=""
          className="size-full object-cover"
        />
      </button>
      {photo.is_primary && (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
          <StarIcon className="size-3" /> Primary
        </span>
      )}
      <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!photo.is_primary && (
          <Button
            size="icon-xs"
            variant="secondary"
            disabled={disabled}
            onClick={onSetPrimary}
            aria-label="Make primary"
          >
            <StarIcon />
          </Button>
        )}
        <Button
          size="icon-xs"
          variant="destructive"
          disabled={disabled}
          onClick={onDelete}
          aria-label="Delete"
        >
          <Trash2Icon />
        </Button>
      </div>
    </li>
  )
}

// Decode → re-encode JPEG via canvas to drop EXIF without external
// dependencies. Mirrors the approach the signup flow uses.
async function stripExif(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0)
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.92,
    )
  })
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
  })
}

function guessExt(mime: string): string | null {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return null
}
