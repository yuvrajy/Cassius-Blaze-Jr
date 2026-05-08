import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminShell } from '@/components/admin/admin-shell'
import { CustomerSearch } from '@/components/admin/customer-search'
import { CustomerRow } from '@/components/admin/customer-row'
import type { ProfileStatus } from '@/lib/types/db'

export const metadata = { title: 'Customers' }

const STATUS_VALUES: ProfileStatus[] = [
  'pending_moderation',
  'live',
  'taken_down',
  'rejected',
]

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const user = await requireAdmin()
  const sp = await searchParams
  const admin = createAdminClient()

  let query = admin
    .from('profiles')
    .select('id, display_name, subdomain, status, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(100)

  if (sp.status && STATUS_VALUES.includes(sp.status as ProfileStatus)) {
    query = query.eq('status', sp.status as ProfileStatus)
  }
  const q = sp.q?.trim()
  if (q) {
    const escaped = q.replace(/[%_,]/g, ' ')
    query = query.or(
      `display_name.ilike.%${escaped}%,subdomain.ilike.%${escaped}%`,
    )
  }

  const { data: rows, error } = await query
  if (error) console.error('[customers] load failed', error)

  // Resolve email per user via auth.admin.getUserById — slow on a big
  // dataset, fine at v1 volume. If the email search filter is set, drop
  // rows where it doesn't match after the auth lookup.
  const enriched = await Promise.all(
    (rows ?? []).map(async (r) => {
      let email: string | null = null
      if (r.user_id) {
        try {
          const { data } = await admin.auth.admin.getUserById(r.user_id)
          email = data.user?.email ?? null
        } catch {
          // ignore — show '—' in the row
        }
      }
      return { ...r, email }
    }),
  )

  const filtered =
    q && enriched.length > 0
      ? enriched.filter(
          (r) =>
            r.display_name.toLowerCase().includes(q.toLowerCase()) ||
            r.subdomain.toLowerCase().includes(q.toLowerCase()) ||
            (r.email ?? '').toLowerCase().includes(q.toLowerCase()),
        )
      : enriched

  return (
    <AdminShell email={user.email} active="customers">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of last 100 by signup date.
          </p>
        </header>

        <CustomerSearch />

        <div className="rounded-xl border border-border/70 bg-card">
          <div className="grid grid-cols-12 gap-3 border-b border-border/70 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            <div className="col-span-1" />
            <div className="col-span-4">Profile</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Joined</div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No matches.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {filtered.map((r) => (
                <li key={r.id}>
                  <CustomerRow
                    id={r.id}
                    displayName={r.display_name}
                    subdomain={r.subdomain}
                    status={r.status}
                    createdAt={r.created_at}
                    email={r.email}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
