import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SignupInput } from '@/lib/contracts/signup'

// Thin helper around the `pending_signups` table. The table was added in
// migration 0003 and isn't yet in lib/types/db.ts (frozen — sub-agent 1's
// next regen will pick it up). We cast the admin client locally so the
// rest of the workflow code stays type-safe.

interface PendingSignupRow {
  id: string
  payload: SignupInput
  created_at: string
  expires_at: string
}

function client() {
  // The shape returned by createAdminClient<Database>() is fully typed but
  // doesn't know about pending_signups yet — narrow to the From<…> generic.
  return createAdminClient() as unknown as {
    from(table: 'pending_signups'): {
      insert(rows: { payload: SignupInput }): Promise<{
        data: { id: string }[] | null
        error: { message: string } | null
      }> & {
        select(cols: string): {
          single(): Promise<{
            data: { id: string } | null
            error: { message: string } | null
          }>
        }
      }
      select(cols: string): {
        eq(col: string, val: string): {
          single(): Promise<{
            data: PendingSignupRow | null
            error: { message: string } | null
          }>
        }
      }
      delete(): {
        eq(col: string, val: string): Promise<{
          error: { message: string } | null
        }>
      }
    }
  }
}

export async function insertPendingSignup(payload: SignupInput): Promise<string> {
  const { data, error } = await client()
    .from('pending_signups')
    .insert({ payload })
    .select('id')
    .single()
  if (error || !data) throw new Error(`pending_signups insert: ${error?.message}`)
  return data.id
}

export async function getPendingSignup(id: string): Promise<PendingSignupRow> {
  const { data, error } = await client()
    .from('pending_signups')
    .select('id, payload, created_at, expires_at')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error(`pending_signups load ${id}: ${error?.message ?? 'not found'}`)
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error(`pending_signups ${id} expired at ${data.expires_at}`)
  }
  return data
}

export async function deletePendingSignup(id: string): Promise<void> {
  const { error } = await client().from('pending_signups').delete().eq('id', id)
  if (error) throw new Error(`pending_signups delete ${id}: ${error.message}`)
}
