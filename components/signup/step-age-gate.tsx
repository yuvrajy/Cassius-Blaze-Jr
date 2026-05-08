'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { TCBox } from './tc-modal'
import { calcAge } from './types'

export function StepAgeGate({
  dob,
  setDob,
  tcAccepted,
  setTcAccepted,
  ageConfirmed,
  setAgeConfirmed,
  selfOrPermission,
  setSelfOrPermission,
  scrolledToBottom,
  setScrolledToBottom,
}: {
  dob: string
  setDob: (v: string) => void
  tcAccepted: boolean
  setTcAccepted: (v: boolean) => void
  ageConfirmed: boolean
  setAgeConfirmed: (v: boolean) => void
  selfOrPermission: boolean
  setSelfOrPermission: (v: boolean) => void
  scrolledToBottom: boolean
  setScrolledToBottom: (v: boolean) => void
}) {
  const [touched, setTouched] = useState(false)
  const age = calcAge(dob)
  const ageError =
    touched && dob && age !== null && age < 18
      ? 'You must be at least 18 to use getknown.'
      : null

  return (
    <div className="space-y-6">
      <Header
        title="A few quick agreements"
        subtitle="We need to know you’re old enough and that you accept our terms before we publish anything about you."
      />

      <div className="space-y-2">
        <Label htmlFor="dob">Date of birth</Label>
        <Input
          id="dob"
          type="date"
          value={dob}
          max={new Date().toISOString().slice(0, 10)}
          onBlur={() => setTouched(true)}
          onChange={e => setDob(e.target.value)}
          className="h-10 max-w-xs"
        />
        {ageError && <p className="text-xs text-destructive">{ageError}</p>}
      </div>

      <div className="space-y-2">
        <Label>Terms of service</Label>
        <TCBox onScrolledToBottom={() => setScrolledToBottom(true)} />
        <p className="text-xs text-muted-foreground">
          {scrolledToBottom
            ? 'Thanks — you can accept below.'
            : 'Scroll to the bottom to enable acceptance.'}
        </p>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={tcAccepted}
            disabled={!scrolledToBottom}
            onCheckedChange={v => setTcAccepted(v === true)}
            className="mt-0.5"
          />
          <span>
            I have read and accept the Terms of Service and Privacy Policy.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={ageConfirmed}
            onCheckedChange={v => setAgeConfirmed(v === true)}
            className="mt-0.5"
          />
          <span>I confirm I am at least 18 years old.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={selfOrPermission}
            onCheckedChange={v => setSelfOrPermission(v === true)}
            className="mt-0.5"
          />
          <span>
            I am the person depicted, or I have written permission from the
            person depicted, to publish this content.
          </span>
        </label>
      </div>
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
