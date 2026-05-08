'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// Compact "label + URL + copy + open" row used on the overview page.
// Copies through navigator.clipboard with a momentary visual confirmation
// so the operator/customer knows it worked.
export function UrlDisplay({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 1200)
    } catch {
      toast.error('Couldn’t copy. Try again.')
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block truncate font-mono text-xs text-foreground hover:underline"
        >
          {url.replace(/^https?:\/\//, '')}
        </a>
      </div>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={copy}
        aria-label="Copy URL"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Open in new tab"
        render={<a href={url} target="_blank" rel="noreferrer" />}
      >
        <ExternalLinkIcon />
      </Button>
    </div>
  )
}
