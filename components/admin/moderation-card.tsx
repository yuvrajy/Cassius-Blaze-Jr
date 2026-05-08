'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  approveProfile,
  rejectProfile,
} from '@/app/service/admin/moderation/actions'

type Photo = { id: string; preview_url: string; is_primary: boolean }

export function ModerationCard({
  profileId,
  displayName,
  subdomain,
  tagline,
  bio,
  createdAt,
  moderationNotes,
  photos,
}: {
  profileId: string
  displayName: string
  subdomain: string
  tagline: string | null
  bio: string
  createdAt: string
  moderationNotes: string | null
  photos: Photo[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [expand, setExpand] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')

  function approve() {
    start(async () => {
      const res = await approveProfile(profileId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`${displayName} approved`)
      router.refresh()
    })
  }

  function reject() {
    if (!reason.trim()) {
      toast.error('Reason is required to reject')
      return
    }
    start(async () => {
      const res = await rejectProfile({ profile_id: profileId, reason })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`${displayName} rejected`)
      setRejectOpen(false)
      setReason('')
      router.refresh()
    })
  }

  return (
    <article className="rounded-xl border border-border/70 bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold tracking-tight">
            {displayName}
          </h3>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{subdomain}</span> · submitted{' '}
            {new Date(createdAt).toLocaleString()}
          </p>
          {tagline && (
            <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={approve}>
            <CheckIcon /> Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => setRejectOpen(true)}
          >
            <XIcon /> Reject
          </Button>
        </div>
      </header>

      {photos.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview_url} alt="" className="size-full object-cover" />
              {p.is_primary && (
                <span className="absolute top-1 left-1 rounded bg-amber-500/90 px-1 text-[9px] uppercase text-white">
                  Primary
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <p
          className={`text-sm whitespace-pre-wrap text-muted-foreground ${
            expand ? '' : 'line-clamp-4'
          }`}
        >
          {bio}
        </p>
        <button
          type="button"
          onClick={() => setExpand((e) => !e)}
          className="mt-1 text-xs text-foreground underline underline-offset-4"
        >
          {expand ? 'Collapse' : 'Read full bio'}
        </button>
      </div>

      {moderationNotes && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200/70">
          <span className="font-medium">Auto-flag:</span> {moderationNotes}
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {displayName}</DialogTitle>
            <DialogDescription>
              The reason is saved on the profile and shown to the customer
              on their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${profileId}`}>Reason</Label>
            <Textarea
              id={`reason-${profileId}`}
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Bio violates the impersonation policy…"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !reason.trim()}
              onClick={reject}
            >
              {pending ? 'Rejecting…' : 'Reject profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
