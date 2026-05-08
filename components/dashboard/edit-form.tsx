'use client'

import { useTransition } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { InfoIcon, Trash2Icon } from 'lucide-react'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveProfile } from '@/app/service/dashboard/edit/actions'

// SignupInput.bio is min(50)/max(7000) characters in lib/contracts/signup.ts.
// We mirror that here. The brief asks for a "word counter, 50–1000 words"
// — that doesn't fit the contract bounds, so we show a character counter
// against the actual enforced bounds. Flagged in the agent-6 handoff.
const PLATFORMS = [
  'twitter',
  'instagram',
  'linkedin',
  'github',
  'tiktok',
  'youtube',
  'email',
  'website',
] as const

const Schema = z.object({
  tagline: z.string().max(120).optional(),
  bio: z
    .string()
    .min(50, 'Bio must be at least 50 characters')
    .max(7000, 'Bio is too long (max 7000 characters)'),
  social_links: z
    .array(
      z.object({
        platform: z.enum(PLATFORMS),
        value: z.string().min(1, 'Required').max(500),
      }),
    )
    .max(6),
})
type FormValues = z.infer<typeof Schema>

export function EditForm({
  displayName,
  subdomain,
  tagline,
  bio,
  socialLinks,
}: {
  displayName: string
  subdomain: string
  tagline: string | null
  bio: string
  socialLinks: { platform: (typeof PLATFORMS)[number]; value: string }[]
}) {
  const [pending, start] = useTransition()
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      tagline: tagline ?? '',
      bio,
      social_links: socialLinks,
    },
  })
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'social_links',
  })

  const bioWatch = form.watch('bio')
  const bioChars = bioWatch?.length ?? 0

  function onSubmit(values: FormValues) {
    start(async () => {
      const res = await saveProfile({
        tagline: values.tagline?.trim() ? values.tagline.trim() : null,
        bio: values.bio,
        social_links: values.social_links,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.bio_changed) {
        toast.success("Saved. We'll re-review your bio.")
      } else {
        toast.success('Saved.')
      }
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = fields.findIndex((f) => f.id === active.id)
    const newIdx = fields.findIndex((f) => f.id === over.id)
    if (oldIdx >= 0 && newIdx >= 0) move(oldIdx, newIdx)
  }

  const reordered = fields.map((f, i) => ({ ...f, _i: i }))
  const orderedIds = reordered.map((f) => f.id)

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Identity
          </h2>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <InfoIcon className="size-3" />
            Display name and subdomain are locked in v1
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" disabled value={displayName} />
            <p className="text-[11px] text-muted-foreground">
              Locked — changing this would disrupt SEO.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subdomain">Subdomain</Label>
            <Input id="subdomain" disabled value={subdomain} />
            <p className="text-[11px] text-muted-foreground">
              Locked — your URL is permanent.
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            placeholder="One short sentence about you"
            maxLength={120}
            {...form.register('tagline')}
          />
          <p className="text-[11px] text-muted-foreground">
            Up to 120 characters. Tagline edits publish immediately.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Bio
          </h2>
          <span
            className={
              bioChars < 50 || bioChars > 7000
                ? 'text-xs text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {bioChars} / 7000 chars
          </span>
        </div>
        <Textarea
          rows={10}
          aria-invalid={!!form.formState.errors.bio}
          {...form.register('bio')}
        />
        {form.formState.errors.bio && (
          <p className="text-xs text-destructive">
            {form.formState.errors.bio.message}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Bio edits flip your profile back to{' '}
          <span className="font-medium">pending review</span>. Most reviews
          finish within 24 hours.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Social links
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={fields.length >= 6}
            onClick={() => append({ platform: 'twitter', value: '' })}
          >
            Add link
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No social links yet.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={orderedIds}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {reordered.map((field) => (
                  <SortableSocialRow
                    key={field.id}
                    id={field.id}
                    index={field._i}
                    onRemove={() => remove(field._i)}
                    register={form.register}
                    setValue={form.setValue}
                    initialPlatform={field.platform}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

function SortableSocialRow({
  id,
  index,
  initialPlatform,
  register,
  setValue,
  onRemove,
}: {
  id: string
  index: number
  initialPlatform: (typeof PLATFORMS)[number]
  register: ReturnType<typeof useForm<FormValues>>['register']
  setValue: ReturnType<typeof useForm<FormValues>>['setValue']
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-2 rounded-lg border border-border/70 bg-background p-2"
      {...attributes}
    >
      <button
        type="button"
        className="cursor-grab px-1 text-muted-foreground"
        aria-label="Drag to reorder"
        {...listeners}
      >
        ⋮⋮
      </button>
      <Select
        defaultValue={initialPlatform}
        onValueChange={(v) =>
          setValue(`social_links.${index}.platform`, v as (typeof PLATFORMS)[number], {
            shouldDirty: true,
          })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLATFORMS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="flex-1"
        placeholder="username or URL"
        {...register(`social_links.${index}.value` as const)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label="Remove"
      >
        <Trash2Icon />
      </Button>
    </li>
  )
}
