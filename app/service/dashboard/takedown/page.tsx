import Link from 'next/link'
import { ArrowLeftIcon, AlertTriangleIcon } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { TakedownConfirm } from '@/components/dashboard/takedown-confirm'

export const metadata = { title: 'Take down profile' }

export default async function TakedownPage() {
  const user = await requireUser()
  return (
    <DashboardShell email={user.email} active="overview">
      <div className="mx-auto max-w-xl space-y-6">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
          <ArrowLeftIcon /> Back to dashboard
        </Button>

        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Take down profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Removes your news article and personal site from public view.
            Search engines re-crawl the change within 24 hours.
          </p>
        </header>

        <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm ring-1 ring-amber-200/70">
          <AlertTriangleIcon className="size-4 shrink-0 text-amber-700" />
          <div className="space-y-1">
            <p className="font-medium text-amber-900">
              This is reversible — but not instantly.
            </p>
            <p className="text-amber-900/80">
              Email{' '}
              <a
                className="underline underline-offset-4"
                href="mailto:hello@getknown.com"
              >
                hello@getknown.com
              </a>{' '}
              if you want to bring your profile back later.
            </p>
          </div>
        </div>

        <TakedownConfirm />
      </div>
    </DashboardShell>
  )
}
