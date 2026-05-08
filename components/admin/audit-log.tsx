type Entry =
  | {
      kind: 'takedown'
      id: string
      created_at: string
      requested_by: string
      reason: string | null
    }
  | {
      kind: 'tc'
      id: string
      accepted_at: string
      tc_version: string
      ip_address: string
      user_agent: string
    }

export function AuditLog({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No audit entries yet.</p>
    )
  }
  const sorted = [...entries].sort((a, b) => {
    const at = a.kind === 'takedown' ? a.created_at : a.accepted_at
    const bt = b.kind === 'takedown' ? b.created_at : b.accepted_at
    return new Date(bt).getTime() - new Date(at).getTime()
  })
  return (
    <ul className="divide-y divide-border/70 rounded-xl border border-border/70 bg-card">
      {sorted.map((e) => (
        <li key={`${e.kind}-${e.id}`} className="px-4 py-3 text-sm">
          {e.kind === 'takedown' ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-red-700">
                  Takedown
                </span>
                <span className="text-xs text-muted-foreground">
                  by {e.requested_by} ·{' '}
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              {e.reason && (
                <p className="mt-1 text-xs text-muted-foreground">
                  &ldquo;{e.reason}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-emerald-700">
                  T&amp;C accepted
                </span>
                <span className="text-xs text-muted-foreground">
                  v{e.tc_version} ·{' '}
                  {new Date(e.accepted_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                {e.ip_address} · {e.user_agent}
              </p>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
