import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Persistent admin chrome — same idea as DashboardShell but with admin
// nav items and a discreet "Customer view" link back to /dashboard.
export function AdminShell({
  email,
  active,
  children,
}: {
  email: string | null | undefined
  active: 'overview' | 'moderation' | 'customers'
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="font-heading text-base font-semibold tracking-tight"
            >
              getknown<span className="text-orange-600">.</span>
              <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                admin
              </span>
            </Link>
            <nav className="hidden items-center gap-4 text-sm sm:flex">
              <NavLink href="/admin" active={active === 'overview'}>
                Overview
              </NavLink>
              <NavLink href="/admin/moderation" active={active === 'moderation'}>
                Moderation
              </NavLink>
              <NavLink href="/admin/customers" active={active === 'customers'}>
                Customers
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {email && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {email}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/dashboard" />}
            >
              Customer view
            </Button>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'text-foreground'
          : 'text-muted-foreground transition-colors hover:text-foreground'
      }
    >
      {children}
    </Link>
  )
}
