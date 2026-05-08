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

## Ownership

This directory is owned by sub-agent 1 (foundation) and **frozen** for
sub-agents 2–7. If a downstream agent discovers a missing field or shape:
1. Stop the implementation.
2. Surface the gap in the agent's handoff report.
3. A human (or sub-agent 1 in a follow-up pass) updates the contract.
4. Resume.

This rule keeps the contract-driven parallelism intact.
