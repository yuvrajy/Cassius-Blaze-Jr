'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { GripVerticalIcon, XIcon } from 'lucide-react'
import type { SocialLinkInput } from '@/lib/contracts/signup'

const PLATFORM_OPTIONS: {
  value: SocialLinkInput['platform']
  label: string
  placeholder: string
}[] = [
  { value: 'twitter', label: 'X / Twitter', placeholder: 'username (no @)' },
  { value: 'instagram', label: 'Instagram', placeholder: 'username' },
  { value: 'linkedin', label: 'LinkedIn', placeholder: 'username or full URL' },
  { value: 'github', label: 'GitHub', placeholder: 'username' },
  { value: 'tiktok', label: 'TikTok', placeholder: 'username (no @)' },
  { value: 'youtube', label: 'YouTube', placeholder: 'channel handle or URL' },
  { value: 'email', label: 'Email', placeholder: 'you@example.com' },
  { value: 'website', label: 'Website', placeholder: 'https://yoursite.com' },
]

export function validateSocialLink(link: SocialLinkInput): string | null {
  const v = link.value.trim()
  if (!v) return 'Required.'
  switch (link.platform) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Invalid email.'
    case 'website': {
      try {
        const u = new URL(v.includes('://') ? v : `https://${v}`)
        return u.hostname.includes('.') ? null : 'Invalid URL.'
      } catch {
        return 'Invalid URL.'
      }
    }
    default: {
      // Handle: alphanumerics, dot, underscore, hyphen. Tolerate URLs by
      // letting the user paste a profile link too.
      if (/^https?:\/\//i.test(v)) {
        try {
          new URL(v)
          return null
        } catch {
          return 'Invalid URL.'
        }
      }
      return /^[A-Za-z0-9._-]{1,64}$/.test(v) ? null : 'Invalid handle.'
    }
  }
}

export function SocialLinkRow({
  id,
  link,
  onChange,
  onRemove,
  error,
}: {
  id: string
  link: SocialLinkInput
  onChange: (next: SocialLinkInput) => void
  onRemove: () => void
  error?: string | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const cur = PLATFORM_OPTIONS.find(p => p.value === link.platform)!

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-9 w-5 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVerticalIcon className="size-4" />
        </button>
        <Select
          value={link.platform}
          onValueChange={(v: string | null) => {
            if (v) onChange({ ...link, platform: v as SocialLinkInput['platform'] })
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={link.value}
          placeholder={cur.placeholder}
          onChange={e => onChange({ ...link, value: e.target.value })}
          className="h-9 flex-1"
        />
        <button
          type="button"
          onClick={onRemove}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Remove link"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      {error && <p className="ml-7 text-xs text-destructive">{error}</p>}
    </div>
  )
}

export { PLATFORM_OPTIONS }
