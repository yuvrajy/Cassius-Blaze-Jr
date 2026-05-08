'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  adminForceTakedown,
  adminResetToPending,
} from './actions'

export function CustomerActions({
  profileId,
  status,
}: {
  profileId: string
  status: 'pending_moderation' | 'live' | 'taken_down' | 'rejected'
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  function reset() {
    start(async () => {
      const res = await adminResetToPending(profileId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Reset to pending')
      router.refresh()
    })
  }

  function takedown() {
    start(async () => {
      const res = await adminForceTakedown(profileId, reason || undefined)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Profile taken down')
      setOpen(false)
      setReason('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'taken_down' && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setOpen(true)}
          disabled={pending}
        >
          Force takedown
        </Button>
      )}
      {status !== 'pending_moderation' && (
        <Button
          size="sm"
          variant="outline"
          onClick={reset}
          disabled={pending}
        >
          Reset to pending
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force takedown</DialogTitle>
            <DialogDescription>
              Removes the profile and article from public view. The lifecycle
              worker handles deindexing and any bespoke-domain release.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="td-reason">Reason (optional)</Label>
            <Textarea
              id="td-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Internal note about why we&rsquo;re pulling this profile"
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={takedown}
              disabled={pending}
            >
              {pending ? 'Taking down…' : 'Take down profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
