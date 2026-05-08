'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { requestTakedown } from '@/app/service/dashboard/takedown/actions'

// Lightweight client guard around the form: ask for typed confirmation
// before enabling submit. Prevents one-click misclicks; still lands on
// the same server action.
export function TakedownConfirm() {
  const [confirm, setConfirm] = useState('')
  const ready = confirm.trim().toLowerCase() === 'take down'

  return (
    <form action={requestTakedown} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Textarea
          id="reason"
          name="reason"
          rows={4}
          placeholder="Why are you taking your profile down?"
          maxLength={1000}
        />
        <p className="text-[11px] text-muted-foreground">
          Helps us improve. Not shown publicly.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">
          Type <span className="font-mono text-foreground">take down</span> to confirm
        </Label>
        <input
          id="confirm"
          type="text"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <Button
        type="submit"
        variant="destructive"
        disabled={!ready}
      >
        Take down my profile
      </Button>
    </form>
  )
}
