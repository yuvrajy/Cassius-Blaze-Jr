import Link from 'next/link'
import type { ProfileStatus } from '@/lib/types/db'

const STATUS_DOT: Record<ProfileStatus, string> = {
  pending_moderation: 'bg-amber-500',
  live: 'bg-emerald-500',
  taken_down: 'bg-zinc-400',
  rejected: 'bg-red-500',
}

export function CustomerRow({
  id,
  displayName,
  subdomain,
  status,
  createdAt,
  email,
}: {
  id: string
  displayName: string
  subdomain: string
  status: ProfileStatus
  createdAt: string
  email: string | null
}) {
  return (
    <Link
      href={`/admin/customers/${id}`}
      className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
    >
      <div className="col-span-1 flex items-center">
        <span
          className={`inline-block size-2 rounded-full ${STATUS_DOT[status]}`}
          aria-label={status}
        />
      </div>
      <div className="col-span-4 truncate">
        <div className="font-medium">{displayName}</div>
        <div className="font-mono text-xs text-muted-foreground">
          {subdomain}
        </div>
      </div>
      <div className="col-span-4 truncate text-xs text-muted-foreground">
        {email ?? '—'}
      </div>
      <div className="col-span-2 text-xs text-muted-foreground">{status}</div>
      <div className="col-span-1 text-right text-xs text-muted-foreground">
        {new Date(createdAt).toLocaleDateString()}
      </div>
    </Link>
  )
}
