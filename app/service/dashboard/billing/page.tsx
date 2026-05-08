import Link from 'next/link'
import { ArrowLeftIcon, CreditCardIcon } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { openBillingPortal } from './actions'

export const metadata = { title: 'Billing' }

const ERRORS: Record<string, string> = {
  no_customer:
    "We don't have a Stripe customer record for you yet — your subscription will appear here once your first payment processes.",
  stripe_not_configured:
    'Billing is not yet configured. Reach out to support.',
  stripe_failed: 'Stripe portal session failed. Try again in a moment.',
  stripe_no_url: 'Stripe portal session failed. Try again in a moment.',
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount_cents, currency, tier, status, stripe_customer_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const sp = await searchParams
  const errorMsg = sp.error ? ERRORS[sp.error] : null
  const hasCustomer = (payments ?? []).some((p) => p.stripe_customer_id)

  return (
    <DashboardShell email={user.email} active="billing">
      <div className="mx-auto max-w-2xl space-y-6">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
          <ArrowLeftIcon /> Back to dashboard
        </Button>

        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Billing
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage payment methods, view receipts, and cancel through the
            Stripe customer portal.
          </p>
        </header>

        {errorMsg && (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200/70">
            {errorMsg}
          </div>
        )}

        <section className="rounded-xl border border-border/70 bg-card p-5">
          {hasCustomer ? (
            <form action={openBillingPortal}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-sm font-semibold tracking-tight">
                    Customer portal
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Opens a Stripe-hosted page in this tab.
                  </p>
                </div>
                <Button type="submit" size="sm">
                  <CreditCardIcon /> Manage billing
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <h2 className="font-heading text-sm font-semibold tracking-tight">
                Billing not set up yet
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your subscription will appear here once your first payment
                processes.
              </p>
            </div>
          )}
        </section>

        {(payments ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="font-heading text-sm font-semibold tracking-tight">
              Payment history
            </h2>
            <ul className="divide-y divide-border/70 rounded-xl border border-border/70 bg-card">
              {payments!.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {formatMoney(p.amount_cents, p.currency)}{' '}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {p.tier}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()} · {p.status}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </DashboardShell>
  )
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}
