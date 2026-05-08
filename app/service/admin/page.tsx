import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import { AdminShell } from '@/components/admin/admin-shell'
import { StatCard } from '@/components/admin/stat-card'
import type { ProfileStatus } from '@/lib/types/db'

export const metadata = { title: 'Admin' }

export default async function AdminOverviewPage() {
  const user = await requireAdmin()
  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from('profiles')
    .select('status, created_at')
  const rows = profiles ?? []

  const counts: Record<ProfileStatus, number> = {
    pending_moderation: 0,
    live: 0,
    taken_down: 0,
    rejected: 0,
  }
  for (const r of rows) counts[r.status as ProfileStatus] += 1

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const within = (ms: number) =>
    rows.filter((r) => now - new Date(r.created_at).getTime() < ms).length
  const last24 = within(day)
  const last7 = within(7 * day)
  const last30 = within(30 * day)

  return (
    <AdminShell email={user.email} active="overview">
      <div className="space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Operations overview
          </h1>
          <div className="flex gap-2">
            <Button size="sm" render={<Link href="/admin/moderation" />}>
              Moderation queue
              {counts.pending_moderation > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {counts.pending_moderation}
                </span>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/admin/customers" />}
            >
              Customers
            </Button>
          </div>
        </header>

        <section>
          <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
            By status
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Pending" value={counts.pending_moderation} />
            <StatCard label="Live" value={counts.live} />
            <StatCard label="Taken down" value={counts.taken_down} />
            <StatCard label="Rejected" value={counts.rejected} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
            Signups
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Last 24h" value={last24} />
            <StatCard label="Last 7d" value={last7} />
            <StatCard label="Last 30d" value={last30} />
          </div>
        </section>
      </div>
    </AdminShell>
  )
}
