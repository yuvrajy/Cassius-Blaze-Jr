'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/db'

// Browser client. Use inside `'use client'` components that need to talk to
// Supabase directly (e.g. Storage uploads from the signup form, realtime
// subscriptions in the dashboard).
//
// This client uses the anon key — RLS still applies. Never put service-role
// credentials in this file.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
