import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { isAdminEmail } from '@/lib/auth'

// Persistent dashboard chrome: header with brand + nav + sign-out, and a
// content slot. Used by every customer-side and admin-side page so the
// nav + sign-out behavior is consistent. Admin links only render for
// signed-in admin emails (cheap server-side check).
export function DashboardShell({
  email,
  active,
  children,
}: {
  email?: string | null
  active: 'overview' | 'edit' | 'photos' | 'billing' | 'admin'
  children: React.ReactNode
}) {
  const showAdmin = isAdminEmail(email)
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-heading text-base font-semibold tracking-tight"
            >
              getknown<span className="text-orange-600">.</span>
            </Link>
            <nav className="hidden items-center gap-4 text-sm sm:flex">
              <NavLink href="/dashboard" active={active === 'overview'}>
                Overview
              </NavLink>
              <NavLink href="/dashboard/edit" active={active === 'edit'}>
                Edit profile
              </NavLink>
              <NavLink href="/dashboard/photos" active={active === 'photos'}>
                Photos
              </NavLink>
              <NavLink href="/dashboard/billing" active={active === 'billing'}>
                Billing
              </NavLink>
              {showAdmin && (
                <NavLink href="/admin" active={active === 'admin'}>
                  Admin
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {email && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {email}
              </span>
            )}
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>
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
