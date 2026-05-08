'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  UniquenessIndicator,
  type UniquenessState,
} from './uniqueness-indicator'

export function StepName({
  value,
  onChange,
  override,
  setOverride,
  uniqueness,
  setUniqueness,
}: {
  value: string
  onChange: (v: string) => void
  override: boolean
  setOverride: (v: boolean) => void
  uniqueness: UniquenessState
  setUniqueness: (s: UniquenessState) => void
}) {
  const [touched, setTouched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = value.trim()
    if (trimmed.length < 2) {
      setUniqueness({ kind: 'idle' })
      return
    }
    debounceRef.current = setTimeout(async () => {
      setUniqueness({ kind: 'loading' })
      try {
        const res = await fetch('/api/uniqueness/check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        })
        if (res.status === 501) {
          setUniqueness({ kind: 'stub' })
          return
        }
        if (!res.ok) {
          setUniqueness({ kind: 'error', message: 'Check failed — try again.' })
          return
        }
        const data = await res.json()
        if (data.stubbed) {
          setUniqueness({ kind: 'stub' })
          return
        }
        setUniqueness({ kind: 'verdict', verdict: data })
      } catch {
        setUniqueness({ kind: 'error', message: 'Network error.' })
      }
    }, 600)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, setUniqueness])

  const lengthError =
    touched && value.trim().length > 0 && value.trim().length < 2
      ? 'Too short.'
      : null

  const showOverride =
    uniqueness.kind === 'verdict' &&
    uniqueness.verdict.severity >= 2 &&
    uniqueness.verdict.severity <= 3

  return (
    <div className="space-y-6">
      <Header
        title="What name should we publish under?"
        subtitle="The exact spelling that should show up in the article and on your personal site."
      />
      <div className="space-y-2">
        <Label htmlFor="display_name">Full display name</Label>
        <Input
          id="display_name"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="e.g. Sarah J. Chen"
          className="h-10"
          autoFocus
        />
        {lengthError && <p className="text-xs text-destructive">{lengthError}</p>}
      </div>

      <UniquenessIndicator
        state={uniqueness}
        onPickVariation={n => {
          onChange(n)
          setOverride(false)
        }}
      />

      {showOverride && (
        <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <Checkbox
            checked={override}
            onCheckedChange={v => setOverride(v === true)}
            className="mt-0.5"
          />
          <span>
            I understand there’s a meaningful collision and want to continue with
            this name anyway.
          </span>
        </label>
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
