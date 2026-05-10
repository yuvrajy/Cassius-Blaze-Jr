import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SignupInput } from '@/lib/contracts/signup'

// Thin helper around the `pending_signups` table. Backed by the typed
// Database in `lib/types/db.ts` (PendingSignupRow exists after agent 1's
// regen), so reads/writes here are fully type-safe.

export interface PendingSignup {
  id: string
  payload: SignupInput
  created_at: string
  expires_at: string
}

export async function insertPendingSignup(payload: SignupInput): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pending_signups')
    .insert({ payload })
    .select('id')
    .single()
  if (error || !data) throw new Error(`pending_signups insert: ${error?.message}`)
  return data.id
}

export async function getPendingSignup(id: string): Promise<PendingSignup> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pending_signups')
    .select('id, payload, created_at, expires_at')
    .eq('id', id)
    .single()
  if (error || !data) {
    throw new Error(`pending_signups load ${id}: ${error?.message ?? 'not found'}`)
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error(`pending_signups ${id} expired at ${data.expires_at}`)
  }
  return {
    id: data.id,
    // db.ts types `payload` as Json; we trust the row was written by
    // /api/signup which inserts a Zod-validated SignupInput.
    payload: data.payload as unknown as SignupInput,
    created_at: data.created_at,
    expires_at: data.expires_at,
  }
}

export async function deletePendingSignup(id: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('pending_signups')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`pending_signups delete ${id}: ${error.message}`)
}
