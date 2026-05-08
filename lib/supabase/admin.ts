import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/db'

// Service-role client. Bypasses RLS entirely. Use this in:
//   - app/api/inngest/route.ts and any background workflow
//   - app/api/stripe/webhook/route.ts
//   - app/api/cron/** routes
//   - admin moderation actions (sub-agent 5/6)
//
// NEVER import this from a `'use client'` file or pass it to the browser.
// The `server-only` import above causes a build error if that happens.
//
// Cookies / session state are intentionally disabled — service-role calls
// have no user identity.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}
