'use client'

import { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2Icon, CheckCircle2Icon, OctagonAlertIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SUBDOMAIN_REGEX } from './types'

export type SubdomainState =
  | { kind: 'idle' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'error' }

const PARENT_DOMAIN = process.env.NEXT_PUBLIC_PARENT_DOMAIN ?? 'iam.bio'

export function StepSubdomain({
  value,
  onChange,
  state,
  setState,
}: {
  value: string
  onChange: (v: string) => void
  state: SubdomainState
  setState: (s: SubdomainState) => void
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value) {
      setState({ kind: 'idle' })
      return
    }
    if (!SUBDOMAIN_REGEX.test(value)) {
      setState({
        kind: 'invalid',
        reason:
          'Use only lowercase letters, numbers, and hyphens (2–40 chars).',
      })
      return
    }

    setState({ kind: 'checking' })
    debounceRef.current = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('profiles')
          .select('subdomain')
          .eq('subdomain', value)
          .limit(1)
          .maybeSingle()
        if (error) {
          setState({ kind: 'error' })
          return
        }
        setState(data ? { kind: 'taken' } : { kind: 'available' })
      } catch {
        setState({ kind: 'error' })
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, setState])

  return (
    <div className="space-y-6">
      <Header
        title="Pick your address"
        subtitle="This is the URL of your personal site. You can change the display name later but the address sticks."
      />

      <div className="space-y-2">
        <Label htmlFor="subdomain">Subdomain</Label>
        <div className="flex h-10 items-stretch overflow-hidden rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Input
            id="subdomain"
            value={value}
            onChange={e => onChange(e.target.value.toLowerCase())}
            placeholder="yourname"
            className="h-full rounded-none border-0 bg-transparent focus-visible:border-0 focus-visible:ring-0"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">
            .{PARENT_DOMAIN}
          </span>
        </div>
        <SubdomainStatus state={state} />
      </div>
    </div>
  )
}

function SubdomainStatus({ state }: { state: SubdomainState }) {
  switch (state.kind) {
    case 'idle':
      return null
    case 'invalid':
      return <p className="text-xs text-destructive">{state.reason}</p>
    case 'checking':
      return (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" /> Checking availability…
        </p>
      )
    case 'available':
      return (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2Icon className="size-3.5" /> Available.
        </p>
      )
    case 'taken':
      return (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <OctagonAlertIcon className="size-3.5" /> Taken — try another.
        </p>
      )
    case 'error':
      return (
        <p className="text-xs text-muted-foreground">
          Couldn’t check right now. We’ll re-verify before publishing.
        </p>
      )
  }
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}
