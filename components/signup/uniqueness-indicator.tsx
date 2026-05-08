'use client'

import { CheckCircle2Icon, AlertTriangleIcon, OctagonAlertIcon, Loader2Icon, InfoIcon } from 'lucide-react'
import type { NameCollisionVerdict } from '@/lib/contracts/moderation'

export type UniquenessVerdict = NameCollisionVerdict & {
  suggested_variations?: string[]
  stubbed?: boolean
}

export type UniquenessState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'stub' }
  | { kind: 'error'; message: string }
  | { kind: 'verdict'; verdict: UniquenessVerdict }

export function UniquenessIndicator({
  state,
  onPickVariation,
}: {
  state: UniquenessState
  onPickVariation?: (name: string) => void
}) {
  if (state.kind === 'idle') return null

  if (state.kind === 'loading') {
    return (
      <Pill tone="neutral">
        <Loader2Icon className="size-4 animate-spin" /> Checking…
      </Pill>
    )
  }

  if (state.kind === 'stub') {
    return (
      <Pill tone="neutral">
        <InfoIcon className="size-4" />
        <span>[uniqueness check stub — assumes severity 0]</span>
      </Pill>
    )
  }

  if (state.kind === 'error') {
    return (
      <Pill tone="warn">
        <AlertTriangleIcon className="size-4" />
        <span>{state.message}</span>
      </Pill>
    )
  }

  const v = state.verdict
  if (v.severity <= 1) {
    return (
      <Pill tone="ok">
        <CheckCircle2Icon className="size-4" />
        <span>Looks clear. {v.summary}</span>
      </Pill>
    )
  }

  if (v.severity <= 3) {
    return (
      <div className="space-y-3">
        <Pill tone="warn">
          <AlertTriangleIcon className="size-4" />
          <span>Potential collision. {v.summary}</span>
        </Pill>
        <EvidenceList results={v.evidence.results} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Pill tone="bad">
        <OctagonAlertIcon className="size-4" />
        <span>Strong collision. {v.summary}</span>
      </Pill>
      <EvidenceList results={v.evidence.results} />
      {!!v.suggested_variations?.length && (
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs font-medium">Try one of these instead:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {v.suggested_variations.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onPickVariation?.(s)}
                className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Pill({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
  children: React.ReactNode
}) {
  const cls = {
    ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    warn: 'bg-amber-50 text-amber-900 ring-amber-200',
    bad: 'bg-red-50 text-red-800 ring-red-200',
    neutral: 'bg-muted text-muted-foreground ring-border',
  }[tone]
  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ${cls}`}
    >
      {children}
    </div>
  )
}

function EvidenceList({
  results,
}: {
  results: { title: string; url: string; snippet: string; domain: string }[]
}) {
  if (!results.length) return null
  return (
    <ul className="space-y-2 rounded-lg border bg-background p-3 text-xs">
      <li className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Top collisions
      </li>
      {results.slice(0, 5).map(r => (
        <li key={r.url} className="border-t pt-2 first:border-t-0 first:pt-0">
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline-offset-2 hover:underline"
          >
            {r.title || r.url}
          </a>
          <p className="text-[11px] text-muted-foreground">{r.domain}</p>
          {r.snippet && (
            <p className="mt-1 text-[11px] text-muted-foreground">{r.snippet}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
