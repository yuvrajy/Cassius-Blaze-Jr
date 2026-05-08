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
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import {
  SocialLinkRow,
  validateSocialLink,
} from './social-link-row'
import type { SocialLinkInput } from '@/lib/contracts/signup'

// Stable key per row that survives reorders. We synthesize an id off the
// (platform,value) pair plus an index salt; if two rows are identical the
// salt keeps them distinct without needing extra state.
function rowId(link: SocialLinkInput, i: number) {
  return `${i}-${link.platform}-${link.value}`
}

export function StepSocial({
  links,
  setLinks,
}: {
  links: SocialLinkInput[]
  setLinks: (next: SocialLinkInput[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const ids = links.map(rowId)

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = ids.indexOf(String(active.id))
    const newIdx = ids.indexOf(String(over.id))
    if (oldIdx < 0 || newIdx < 0) return
    setLinks(arrayMove(links, oldIdx, newIdx))
  }

  return (
    <div className="space-y-6">
      <Header
        title="Social links"
        subtitle="Optional. We surface these on your personal site and inside the article so search engines connect them to you."
      />

      {links.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {links.map((link, i) => {
                const err = validateSocialLink(link)
                return (
                  <SocialLinkRow
                    key={ids[i]}
                    id={ids[i]}
                    link={link}
                    onChange={next =>
                      setLinks(links.map((l, j) => (j === i ? next : l)))
                    }
                    onRemove={() =>
                      setLinks(links.filter((_, j) => j !== i))
                    }
                    error={link.value.length > 0 ? err : null}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          You don’t have to add any. Press skip below if you’d rather move on.
        </p>
      )}

      {links.length < 6 && (
        <Button
          type="button"
          variant="outline"
          className="h-9"
          onClick={() =>
            setLinks([...links, { platform: 'twitter', value: '' }])
          }
        >
          <PlusIcon className="size-3.5" /> Add link
        </Button>
      )}
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
