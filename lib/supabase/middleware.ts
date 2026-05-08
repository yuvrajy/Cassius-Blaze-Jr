import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { Database } from '@/lib/types/db'

// Middleware-safe Supabase client. Refreshes the session cookie if it has
// expired, so server components downstream see a current `auth.uid()`.
//
// USAGE: the root middleware.ts is currently pure-routing (rewrites by
// hostname). When auth-aware routing is needed (e.g. redirect signed-out
// users away from /dashboard), call `updateSession(req)` BEFORE the rewrite
// and merge cookies onto the rewritten response.
//
// Sub-agent 5 will likely wire this up when building protected routes.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Touch the session so cookies are refreshed if needed.
  await supabase.auth.getUser()

  return response
}
