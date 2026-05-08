'use client'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { countWords } from './types'

export function StepBio({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { words, chars } = countWords(value)
  const tooFew = words < 50
  const tooMany = words > 1000
  const overChars = chars > 7000

  let hint: { tone: 'ok' | 'warn' | 'bad'; text: string }
  if (overChars) {
    hint = { tone: 'bad', text: `${chars} characters — over the 7,000 limit.` }
  } else if (tooMany) {
    hint = { tone: 'bad', text: `${words} words — keep it under 1,000.` }
  } else if (tooFew) {
    hint = { tone: 'warn', text: `${words} / 50 words minimum.` }
  } else {
    hint = { tone: 'ok', text: `${words} words.` }
  }

  const toneCls = {
    ok: 'text-emerald-700',
    warn: 'text-muted-foreground',
    bad: 'text-destructive',
  }[hint.tone]

  return (
    <div className="space-y-6">
      <Header
        title="Your bio"
        subtitle="A few paragraphs that capture who you are. Our editors will turn this into your news article — the more honest detail you give us, the better the piece."
      />
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={10}
          placeholder="Who are you, what do you do, what should people know?"
          className="min-h-56 resize-y"
        />
        <p className={`text-xs ${toneCls}`}>{hint.text}</p>
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
