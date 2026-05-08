'use client'

import { STEP_LABELS, TOTAL_STEPS } from './types'

export function StepIndicator({ step }: { step: number }) {
  const pct = Math.round(((step + 1) / TOTAL_STEPS) * 100)
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-mono uppercase tracking-[0.2em] text-orange-700">
          Step {step + 1} of {TOTAL_STEPS}
        </span>
        <span className="text-muted-foreground">{STEP_LABELS[step]}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-foreground transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
