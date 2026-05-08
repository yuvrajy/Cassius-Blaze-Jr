'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  PhotoDropzone,
  deletePhotoFromStorage,
  type UploadedPhoto,
  type UploadError,
} from './photo-uploader'
import { PhotoCard } from './photo-card'
import type { PhotoUploadInput } from '@/lib/contracts/signup'

// Extract the photo_uuid from a draft storage path:
//   draft/{session_id}/{photo_uuid}.jpg → photo_uuid
function uuidFromPath(p: string): string {
  const file = p.split('/').pop() ?? p
  return file.replace(/\.[^.]+$/, '')
}

function publicUrlFor(path: string): string {
  const supabase = createClient()
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

export function StepPhotos({
  sessionId,
  photos,
  setPhotos,
}: {
  sessionId: string
  photos: PhotoUploadInput[]
  setPhotos: (next: PhotoUploadInput[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const remaining = 5 - photos.length

  function handleUploaded(p: UploadedPhoto) {
    // First photo becomes primary by default.
    const isFirst = photos.length === 0
    const next: PhotoUploadInput = {
      storage_path: p.storage_path,
      is_primary: isFirst,
      sort_order: photos.length as 0 | 1 | 2 | 3 | 4,
      consent_attested: false as unknown as true,
    }
    setPhotos([...photos, next])
  }

  function handleError(e: UploadError) {
    toast.error(`Couldn’t upload ${e.file}`, { description: e.message })
  }

  function setPrimary(uuid: string) {
    setPhotos(
      photos.map(p => ({
        ...p,
        is_primary: uuidFromPath(p.storage_path) === uuid,
      })),
    )
  }

  function setConsent(uuid: string, next: boolean) {
    setPhotos(
      photos.map(p =>
        uuidFromPath(p.storage_path) === uuid
          ? ({ ...p, consent_attested: next as unknown as true })
          : p,
      ),
    )
  }

  async function remove(uuid: string) {
    const target = photos.find(p => uuidFromPath(p.storage_path) === uuid)
    if (!target) return
    const wasPrimary = target.is_primary
    const remainder = photos
      .filter(p => uuidFromPath(p.storage_path) !== uuid)
      .map((p, i) => ({
        ...p,
        sort_order: i as 0 | 1 | 2 | 3 | 4,
        is_primary: wasPrimary && i === 0 ? true : p.is_primary,
      }))
    setPhotos(remainder)
    try {
      await deletePhotoFromStorage(target.storage_path)
    } catch {
      // Storage delete is best-effort; the file becomes orphan but harmless.
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = photos.findIndex(
      p => uuidFromPath(p.storage_path) === active.id,
    )
    const newIdx = photos.findIndex(
      p => uuidFromPath(p.storage_path) === over.id,
    )
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(photos, oldIdx, newIdx).map((p, i) => ({
      ...p,
      sort_order: i as 0 | 1 | 2 | 3 | 4,
    }))
    setPhotos(reordered)
  }

  const ids = photos.map(p => uuidFromPath(p.storage_path))

  return (
    <div className="space-y-6">
      <Header
        title="Your photos"
        subtitle="A clear, well-lit portrait works best. We strip GPS data and other metadata before saving anything."
      />

      {photos.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {photos.map(p => {
                const uuid = uuidFromPath(p.storage_path)
                return (
                  <PhotoCard
                    key={uuid}
                    photo={{
                      photo_uuid: uuid,
                      storage_path: p.storage_path,
                      preview_url: publicUrlFor(p.storage_path),
                      is_primary: p.is_primary,
                      consent_attested:
                        (p.consent_attested as unknown as boolean) === true,
                    }}
                    onTogglePrimary={() => setPrimary(uuid)}
                    onToggleConsent={v => setConsent(uuid, v)}
                    onRemove={() => remove(uuid)}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <PhotoDropzone
        sessionId={sessionId}
        remainingSlots={remaining}
        onUploaded={handleUploaded}
        onError={handleError}
      />

      <p className="text-xs text-muted-foreground">
        Upload 1–5 photos. Mark one as the primary photo (used for OG/social
        cards). Each photo needs the consent box checked.
      </p>
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}
