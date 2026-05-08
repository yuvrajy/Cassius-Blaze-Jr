import type { ProfileStatus } from '@/lib/types/db'

// Color + copy lookup for each profile status. The dashboard overview and
// the public-facing pages share status semantics, but only the dashboard
// uses this banner — the news/personal sites just hide themselves when
// !=='live'. Keep copy short; status-specific detail goes in StatusMessage
// below.
const STATUS_STYLES: Record<
  ProfileStatus,
  { dot: string; bg: string; ring: string; label: string }
> = {
  pending_moderation: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200/70',
    label: 'Pending review',
  },
  live: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200/70',
    label: 'Live',
  },
  taken_down: {
    dot: 'bg-zinc-400',
    bg: 'bg-zinc-50',
    ring: 'ring-zinc-200',
    label: 'Taken down',
  },
  rejected: {
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    ring: 'ring-red-200/70',
    label: 'Rejected',
  },
}

export function StatusBanner({ status }: { status: ProfileStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 ring-1 ${s.bg} ${s.ring}`}
    >
      <span className={`size-2 rounded-full ${s.dot}`} aria-hidden />
      <span className="text-xs font-medium">{s.label}</span>
    </div>
  )
}

export function StatusMessage({
  status,
  notes,
}: {
  status: ProfileStatus
  notes: string | null
}) {
  switch (status) {
    case 'pending_moderation':
      return (
        <p className="text-sm text-muted-foreground">
          We&rsquo;re reviewing your submission. Most reviews finish within 24
          hours.
        </p>
      )
    case 'live':
      return (
        <p className="text-sm text-muted-foreground">
          Your profile is live. Share it!
        </p>
      )
    case 'taken_down':
      return (
        <p className="text-sm text-muted-foreground">
          Your profile is currently taken down. Want to bring it back?{' '}
          <a
            href="mailto:hello@getknown.com"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Contact support.
          </a>
        </p>
      )
    case 'rejected':
      return (
        <p className="text-sm text-muted-foreground">
          Your submission was rejected.
          {notes ? <> Reason: {notes}</> : null}
        </p>
      )
  }
}
