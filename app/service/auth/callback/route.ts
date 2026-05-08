import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Magic-link callback. Supabase appends `?code=...` to whatever URL we
// passed as `emailRedirectTo`. We exchange it for a session, set the
// cookie, then redirect — to `next` if it's a same-host path, otherwise
// to /dashboard. On failure we send the user back to /login with a short
// error code so the form can render a toast.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const nextParam = url.searchParams.get('next')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=expired', request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchange failed', error)
    return NextResponse.redirect(
      new URL('/login?error=exchange_failed', request.url),
    )
  }

  const dest = safeNext(nextParam) ?? '/dashboard'
  return NextResponse.redirect(new URL(dest, request.url))
}

// Allow only same-origin path redirects (must start with "/" and not "//"
// or include a scheme). Anything else, fall back to /dashboard.
function safeNext(next: string | null): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  if (next.includes('://')) return null
  return next
}
