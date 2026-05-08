import 'server-only'
import type { PaymentRow, ProfileRow } from '@/lib/types/db'

// Type extensions for the columns added in supabase/migrations/0004.
// `lib/types/db.ts` is owned by sub-agent 1; rather than reach into it,
// we layer the new columns here and cast at the supabase-js boundary
// inside the lifecycle helpers.

export interface LifecycleProfileColumns {
  expiry_warning_sent_at: string | null
  takedown_finalized_at: string | null
  bespoke_domain_email_sent_at: string | null
}

export type LifecycleProfileRow = ProfileRow & LifecycleProfileColumns

export interface BespokePaymentColumns {
  bespoke_domain_chosen: string | null
}

export type BespokePaymentRow = PaymentRow & BespokePaymentColumns
