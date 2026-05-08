import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fullUrlFor } from '@/lib/contracts/profile'
import { articleUrl, profileUrls } from '@/lib/contracts/revalidation'
import { Button } from '@/components/ui/button'
import { AdminShell } from '@/components/admin/admin-shell'
import { AuditLog } from '@/components/admin/audit-log'
import { CustomerActions } from './customer-actions'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const adminUser = await requireAdmin()
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, photos:photos(*), social_links:social_links(*)')
    .eq('id', id)
    .maybeSingle()
  if (!profile) notFound()

  const [{ data: article }, { data: payments }, { data: takedowns }, { data: tc }, photoUrls] =
    await Promise.all([
      admin.from('articles').select('*').eq('profile_id', id).maybeSingle(),
      admin
        .from('payments')
        .select('*')
        .eq('profile_id', id)
        .order('created_at', { ascending: false }),
      admin
        .from('takedowns')
        .select('*')
        .eq('profile_id', id)
        .order('created_at', { ascending: false }),
      admin
        .from('tc_acceptances')
        .select('*')
        .eq('profile_id', id)
        .order('accepted_at', { ascending: false }),
      Promise.all(
        ((profile.photos ?? []) as Array<{
          id: string
          storage_path: string
          is_primary: boolean
          variants: { thumb?: string; medium?: string }
          sort_order: number
        }>)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(async (p) => ({
            id: p.id,
            is_primary: p.is_primary,
            url:
              p.variants?.medium ??
              p.variants?.thumb ??
              (
                await admin.storage
                  .from('photos')
                  .createSignedUrl(p.storage_path, 3600)
              ).data?.signedUrl ??
              '',
          })),
      ),
    ])

  let userEmail: string | null = null
  if (profile.user_id) {
    try {
      const { data } = await admin.auth.admin.getUserById(profile.user_id)
      userEmail = data.user?.email ?? null
    } catch {
      // ignore
    }
  }

  const urls = profileUrls(profile)
  const audit: Parameters<typeof AuditLog>[0]['entries'] = [
    ...((takedowns ?? []) as Array<{
      id: string
      created_at: string
      requested_by: string
      reason: string | null
    }>).map((t) => ({
      kind: 'takedown' as const,
      id: t.id,
      created_at: t.created_at,
      requested_by: t.requested_by,
      reason: t.reason,
    })),
    ...((tc ?? []) as Array<{
      id: string
      accepted_at: string
      tc_version: string
      ip_address: string
      user_agent: string
    }>).map((t) => ({
      kind: 'tc' as const,
      id: t.id,
      accepted_at: t.accepted_at,
      tc_version: t.tc_version,
      ip_address: t.ip_address,
      user_agent: t.user_agent,
    })),
  ]

  const stripeChargeUrl = (subId: string | null, custId: string | null) => {
    // Deep link the moderator into Stripe — agent 7 / agent 6 handle real
    // refund flows, so we just point at the right place.
    if (custId) return `https://dashboard.stripe.com/customers/${custId}`
    if (subId) return `https://dashboard.stripe.com/subscriptions/${subId}`
    return null
  }

  return (
    <AdminShell email={adminUser.email} active="customers">
      <div className="space-y-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/admin/customers" />}
          >
            <ArrowLeftIcon /> Back to customers
          </Button>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {profile.display_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{profile.subdomain}</span> ·{' '}
              {userEmail ?? 'no email on file'} · status:{' '}
              <span className="font-medium">{profile.status}</span>
            </p>
          </div>
          <CustomerActions
            profileId={profile.id}
            status={profile.status}
          />
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Block title="Bio">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {profile.bio}
              </p>
            </Block>

            <Block title="Photos">
              {photoUrls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No photos.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto">
                  {photoUrls.map((p) => (
                    <div
                      key={p.id}
                      className="relative size-28 shrink-0 overflow-hidden rounded-lg bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt=""
                        className="size-full object-cover"
                      />
                      {p.is_primary && (
                        <span className="absolute top-1 left-1 rounded bg-amber-500/90 px-1 text-[9px] uppercase text-white">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Block>

            <Block title="Social links">
              {(profile.social_links ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="space-y-1.5">
                  {(profile.social_links as Array<{
                    id: string
                    platform: 'twitter' | 'instagram' | 'linkedin' | 'github' | 'tiktok' | 'youtube' | 'email' | 'website'
                    value: string
                  }>).map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        {l.platform}
                      </span>
                      <a
                        href={fullUrlFor(l)}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:underline"
                      >
                        {l.value}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block title="Audit log">
              <AuditLog entries={audit} />
            </Block>
          </div>

          <div className="space-y-6">
            <Block title="Public URLs">
              {profile.status === 'live' ? (
                <ul className="space-y-2 text-sm">
                  {article && (
                    <li>
                      <a
                        className="inline-flex items-center gap-1 hover:underline"
                        href={articleUrl(article)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        News article <ExternalLinkIcon className="size-3" />
                      </a>
                    </li>
                  )}
                  <li>
                    <a
                      className="inline-flex items-center gap-1 hover:underline"
                      href={urls.personal}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Personal site <ExternalLinkIcon className="size-3" />
                    </a>
                  </li>
                  {profile.bespoke_domain && (
                    <li>
                      <a
                        className="inline-flex items-center gap-1 hover:underline"
                        href={`https://${profile.bespoke_domain}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Bespoke domain <ExternalLinkIcon className="size-3" />
                      </a>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not live (status: {profile.status}).
                </p>
              )}
            </Block>

            <Block title="Payments">
              {(payments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">None on file.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(payments as Array<{
                    id: string
                    amount_cents: number
                    currency: string
                    tier: string
                    status: string
                    created_at: string
                    stripe_subscription_id: string | null
                    stripe_customer_id: string | null
                  }>).map((p) => {
                    const link = stripeChargeUrl(
                      p.stripe_subscription_id,
                      p.stripe_customer_id,
                    )
                    return (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-medium">
                            {(p.amount_cents / 100).toFixed(2)}{' '}
                            {p.currency.toUpperCase()} · {p.tier}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(p.created_at).toLocaleString()} ·{' '}
                            {p.status}
                          </div>
                        </div>
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline underline-offset-4 hover:text-foreground"
                          >
                            Stripe ↗
                          </a>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Refund through Stripe directly — we don&rsquo;t programmatically
                refund in v1.
              </p>
            </Block>

            {profile.moderation_notes && (
              <Block title="Moderation notes">
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {profile.moderation_notes}
                </p>
              </Block>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  )
}

function Block({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-sm font-semibold tracking-tight">
        {title}
      </h2>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        {children}
      </div>
    </section>
  )
}
