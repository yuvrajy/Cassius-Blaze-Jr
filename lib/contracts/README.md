# lib/contracts/

This directory holds the **frozen interfaces** that all six parallel agents
code against. Read this before touching anything else.

## Why contracts matter

Agents 2–7 work in parallel, in separate file lanes. The only thing that
keeps their code compatible is the set of types, schemas, and helper
function signatures defined here. If two agents both reach into a contract
and modify it independently, the merge will conflict and the system breaks.

**Rule:** sub-agents 2–7 import from `lib/contracts/` but never edit it. If
an agent finds a contract gap, it stops and reports — sub-agent 1 (or a
human) updates the contract first.

## Files

| File | Purpose | Producers | Consumers |
|------|---------|-----------|-----------|
| [`signup.ts`](./signup.ts) | Zod schemas + types for the signup form payload | sub-agent 2 (assembles), sub-agent 6 (re-validates) | both |
| [`profile.ts`](./profile.ts) | Joined `ProfileWithAssets` / `ArticleWithProfile` shapes; `primaryPhotoUrl()`, `fullUrlFor()` helpers | sub-agent 6 (DB queries) | sub-agents 3, 4, 5 (renderers) |
| [`moderation.ts`](./moderation.ts) | Verdict shapes (bio / photo / name collision) | sub-agent 6 (runs checks) | sub-agent 5 (admin queue), sub-agent 2 (live preview) |
| [`events.ts`](./events.ts) | `Events` map + payload types for Inngest | sub-agents 2, 6, 7 (firers) | sub-agent 6 (handlers) |
| [`revalidation.ts`](./revalidation.ts) | Cross-site URL builders (`articleUrl`, `profileUrls`) and `revalidateProfile()` | sub-agents 6, 7 (after state changes) | sub-agents 3, 4, 5 (canonical URLs) |

## How to use

```ts
// In a sub-agent's code, always import from the contract:
import { SignupInput } from '@/lib/contracts/signup'
import { ArticleWithProfile, primaryPhotoUrl } from '@/lib/contracts/profile'
import { Events } from '@/lib/contracts/events'
import { articleUrl, revalidateProfile } from '@/lib/contracts/revalidation'

// Never re-declare these types or helpers locally.
```

## What's NOT in here

- **DB row shapes** — those live in [`@/lib/types/db.ts`](../types/db.ts).
  Contracts re-export them as joined views (e.g. `ProfileWithAssets`).
  Sub-agents that work directly with row shapes (most write paths) import
  from `@/lib/types/db` instead.
- **Stripe / Resend / Porkbun client types** — those are vendor SDK types
  and live in the corresponding `@/lib/<vendor>/` modules built by the
  agents that own them.

## Auth lifecycle for signup

The signup wizard does not gate the form behind a "create account" step.
Instead it claims a Supabase user_id up-front so storage RLS works during
the form, then upgrades that same row to email-auth after Stripe
confirms. The user_id is stable across the whole flow — no photo
migration, no row swapping.

1. **Form mount (sub-agent 2).** The wizard calls
   `supabase.auth.signInAnonymously()` on first paint and captures the
   resulting `user_id`. The user is now signed in (anonymously); RLS
   sees them as `auth.uid() = user_id`.
2. **Photo uploads (sub-agent 2).** Drafts are written to
   `{user_id}/draft/{photo_uuid}.{ext}` in the `photos` bucket. The
   storage RLS policy already allows writes to objects whose first path
   segment matches `auth.uid()`, so no new policy is needed.
3. **Form submit (sub-agent 2 → 6).** `SignupInput` ships the `user_id`,
   the `email` the customer entered, and the `tier`. `/api/signup`
   re-validates, persists a `pending_signups` row, creates a Stripe
   Checkout session with `metadata.pending_signup_id`, and redirects.
4. **Webhook (sub-agent 6).** On `checkout.session.completed`, the
   handler fires `Events.SIGNUP_PAID` with `pending_signup_id` carried
   directly on the payload (see `events.ts`).
5. **Publish pipeline (sub-agent 6).** The Inngest function:
   - calls `supabase.auth.admin.updateUserById(user_id, { email })` to
     upgrade the anonymous row to email-auth — same `user_id`, so
     storage objects under `{user_id}/...` keep working;
   - moves the photos out of `{user_id}/draft/...` to a permanent
     prefix and writes `photos` rows;
   - inserts/finalizes the `profiles` and `articles` rows.

Result: by the time the customer first sees their dashboard, they're
signed in to a normal email-auth Supabase account whose `user_id` is the
same one that owned every draft photo.

## Ownership

This directory is owned by sub-agent 1 (foundation) and **frozen** for
sub-agents 2–7. If a downstream agent discovers a missing field or shape:
1. Stop the implementation.
2. Surface the gap in the agent's handoff report.
3. A human (or sub-agent 1 in a follow-up pass) updates the contract.
4. Resume.

This rule keeps the contract-driven parallelism intact.
