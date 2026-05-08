'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Checkbox } from '@/components/ui/checkbox'
import { GripVerticalIcon, XIcon, StarIcon } from 'lucide-react'

export type PhotoCardData = {
  photo_uuid: string
  storage_path: string
  preview_url: string
  is_primary: boolean
  consent_attested: boolean
}

export function PhotoCard({
  photo,
  onTogglePrimary,
  onToggleConsent,
  onRemove,
}: {
  photo: PhotoCardData
  onTogglePrimary: () => void
  onToggleConsent: (next: boolean) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.photo_uuid })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-xl border bg-background p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-0.5 flex h-9 w-6 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.preview_url}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePrimary}
            className={
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ' +
              (photo.is_primary
                ? 'bg-orange-50 text-orange-800 ring-orange-200'
                : 'bg-background text-muted-foreground ring-border hover:bg-muted')
            }
          >
            <StarIcon
              className={
                'size-3.5 ' + (photo.is_primary ? 'fill-orange-500 text-orange-500' : '')
              }
            />
            {photo.is_primary ? 'Primary' : 'Make primary'}
          </button>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={photo.consent_attested}
            onCheckedChange={v => onToggleConsent(v === true)}
            className="mt-0.5"
          />
          <span>I own this photo or have permission to publish it.</span>
        </label>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Remove photo"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}
