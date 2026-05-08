'use client'

import { Button } from '@/components/ui/button'
import { PencilIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SignupInput } from '@/lib/contracts/signup'
import { PLATFORM_OPTIONS } from './social-link-row'
import { countWords } from './types'

const PARENT_DOMAIN = process.env.NEXT_PUBLIC_PARENT_DOMAIN ?? 'iam.bio'

function publicUrlFor(path: string): string {
  const supabase = createClient()
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

export function StepReview({
  values,
  goTo,
}: {
  values: SignupInput
  goTo: (step: number) => void
}) {
  const { words } = countWords(values.bio)
  return (
    <div className="space-y-6">
      <Header
        title="Review and publish"
        subtitle="Last look. Edit anything you’d like to change, then continue to checkout."
      />

      <ReviewCard label="Name" onEdit={() => goTo(1)}>
        <p className="font-medium">{values.display_name}</p>
        <p className="text-xs text-muted-foreground">DOB: {values.dob}</p>
      </ReviewCard>

      <ReviewCard label="Address" onEdit={() => goTo(2)}>
        <p className="font-mono text-sm">
          {values.subdomain || '—'}.{PARENT_DOMAIN}
        </p>
      </ReviewCard>

      <ReviewCard label="Bio" onEdit={() => goTo(3)}>
        <p className="whitespace-pre-line text-sm leading-relaxed">
          {values.bio.length > 360
            ? values.bio.slice(0, 360).trim() + '…'
            : values.bio}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{words} words</p>
      </ReviewCard>

      <ReviewCard label="Tagline" onEdit={() => goTo(4)}>
        <p className="text-sm">
          {values.tagline ? values.tagline : <span className="text-muted-foreground">— none —</span>}
        </p>
      </ReviewCard>

      <ReviewCard label={`Photos (${values.photos.length})`} onEdit={() => goTo(5)}>
        <ul className="flex flex-wrap gap-2">
          {values.photos.map(p => (
            <li
              key={p.storage_path}
              className="relative size-16 overflow-hidden rounded-md bg-muted ring-1 ring-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrlFor(p.storage_path)}
                alt=""
                className="h-full w-full object-cover"
              />
              {p.is_primary && (
                <span className="absolute right-0.5 bottom-0.5 rounded bg-orange-500 px-1 text-[9px] font-medium text-white">
                  Primary
                </span>
              )}
            </li>
          ))}
        </ul>
      </ReviewCard>

      <ReviewCard label={`Links (${values.social_links.length})`} onEdit={() => goTo(6)}>
        {values.social_links.length === 0 ? (
          <p className="text-sm text-muted-foreground">— none —</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {values.social_links.map((l, i) => {
              const opt = PLATFORM_OPTIONS.find(o => o.value === l.platform)
              return (
                <li key={`${i}-${l.platform}`} className="flex gap-2">
                  <span className="w-24 shrink-0 text-muted-foreground">
                    {opt?.label ?? l.platform}
                  </span>
                  <span className="font-mono text-xs">{l.value}</span>
                </li>
              )
            })}
          </ul>
        )}
      </ReviewCard>
    </div>
  )
}

function ReviewCard({
  label,
  children,
  onEdit,
}: {
  label: string
  children: React.ReactNode
  onEdit: () => void
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onEdit}
          className="text-xs"
        >
          <PencilIcon className="size-3" /> Edit
        </Button>
      </div>
      <div>{children}</div>
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
