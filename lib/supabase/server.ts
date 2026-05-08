import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/db'

// Server-component / route-handler client. Reads the session cookie set by
// the auth middleware (`lib/supabase/middleware.ts`) and lets server code
// execute as the signed-in user with RLS applied.
//
// Use this in: app/**/page.tsx (RSC), app/**/layout.tsx (RSC),
// app/api/**/route.ts handlers that should run as the user.
//
// For privileged operations (writing to RLS-locked tables, bypassing RLS),
// use `lib/supabase/admin.ts` instead.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — Next forbids cookie writes there.
            // Safe to swallow; middleware refreshes the session on navigation.
          }
        },
      },
    },
  )
}
