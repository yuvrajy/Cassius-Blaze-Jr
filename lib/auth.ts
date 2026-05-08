import 'server-only'
import { redirect } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Server-only auth helpers used by every page in /service/dashboard and
// /service/admin. Three flavors:
//   getSession()    → returns null when signed-out (caller decides)
//   requireUser()   → 307s to /login when signed-out
//   requireAdmin()  → 307s to /dashboard when signed-out OR not an admin
//
// requireAdmin() checks the signed-in email against the comma-separated
// ADMIN_EMAILS env var. We deliberately don't render a "denied" page —
// admin presence isn't advertised, the user just lands on their dashboard.

export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (!isAdminEmail(user.email)) redirect('/dashboard')
  return user
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email.toLowerCase())
}
