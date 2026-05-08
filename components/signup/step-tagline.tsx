'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function StepTagline({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const len = value.length
  const over = len > 120
  return (
    <div className="space-y-6">
      <Header
        title="A one-line tagline"
        subtitle="Optional. This shows up under your name in search results and on the personal site hero. Keep it short."
      />
      <div className="space-y-2">
        <Label htmlFor="tagline">Tagline</Label>
        <Input
          id="tagline"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. Cardiologist, runner, parent of two."
          className="h-10"
          maxLength={140}
        />
        <p
          className={`text-xs ${
            over ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {len}/120 characters{over ? ' — over the limit.' : ''}
        </p>
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
