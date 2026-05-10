# Project context

Single source of truth for anyone (human or model) joining this project mid-flight.

---

## What we're building

A service that helps people make themselves findable on Google. Customer pays, fills out a form (bio + 1–5 photos + social links), and we publish three things on their behalf:

1. **A news-style article** about them on `thenorm.info` (looks like a real publication; gives the customer a third-party-published bio that ranks)
2. **A personal site** at `<their-name>.mybio.cloud` (their own SEO target — full Person JSON-LD, OG image, sameAs links across platforms)
3. **(Paid upsell)** A bespoke domain like `<their-name>.xyz` that 301-redirects to the personal subdomain

The two pages cross-link with no `nofollow`, so authority flows both ways. The whole architecture is engineered to make a customer rank in Google for their own name within weeks instead of years.

## Domains (locked in)

| Domain | Role | Status |
|---|---|---|
| `thenorm.info` | News site (editorial, customer-facing brand) | Owned |
| `mybio.cloud` | Parent for personal subdomains (e.g. `sarah.mybio.cloud`) | To buy |
| `theplaybook.site` | Service marketing + signup + dashboards | To buy |

Set in env as `NEXT_PUBLIC_HUB_DOMAIN`, `NEXT_PUBLIC_PARENT_DOMAIN`, `NEXT_PUBLIC_SERVICE_DOMAIN`.

## Architecture

**One Next.js 15 + Supabase repo. One Vercel deployment. Three hostnames** routed by `middleware.ts` based on `Host` header:

```
thenorm.info          → /news/...           (editorial)
*.mybio.cloud         → /personal/[sub]/... (multi-tenant personal sites)
theplaybook.site      → /service/...        (marketing + signup + dashboards)
```

The middleware rewrites (not redirects) so the user-visible URL stays clean.

**Bespoke domains** (`sarah.xyz`) bypass middleware entirely — they're attached to Vercel as redirect-type domains pointing at the subdomain. Vercel handles the 301 at the edge.

## Tech stack

- **Next.js 15** (App Router, TypeScript, Tailwind v4, shadcn/ui — base-nova style)
- **Supabase** — Postgres + Auth (magic-link + anonymous) + Storage
- **Stripe** — payments + customer portal
- **Inngest** — async workflow orchestration (the publish pipeline lives here)
- **Resend** — transactional email
- **Anthropic Claude** — bio moderation + article generation + name-collision verdict
- **Vercel** — hosting (with cron for daily expiry/takedown jobs)
- **Porkbun** — bespoke domain registration (paid tier only)
- **sharp** — server-side photo variants
- **Sightengine + TinEye** — photo moderation (deferred for v1)
- **Google Custom Search** — name uniqueness signal (deferred for v1)

`pnpm build` uses webpack (not turbopack — turbopack 15.5 has a font bundler bug).

## Repo structure

```
app/
├── news/                    thenorm.info pages
├── personal/[subdomain]/    *.mybio.cloud pages (multi-tenant)
├── service/                 theplaybook.site pages
│   ├── page.tsx             marketing landing
│   ├── signup/              8-step wizard
│   ├── dashboard/           customer dashboard
│   ├── admin/               operator dashboard
│   ├── login/               magic-link login
│   └── auth/                callback + signout
└── api/                     server endpoints (split by lane below)

components/
├── news/                    article cards, byline, JSON-LD, etc.
├── personal/                hero, bio, gallery, social-icons, JSON-LD
├── signup/                  wizard steps + photo uploader
├── dashboard/               customer-side surfaces
└── admin/                   moderation queue, customer search

lib/
├── contracts/               FROZEN — Zod schemas, types, event names, revalidation helpers
├── supabase/                4 typed clients: server, client, middleware, admin
├── types/db.ts              Database row types (regenerate via `supabase gen types`)
├── inngest/                 Inngest client + function handlers (signup-paid, takedown, etc.)
├── moderation/              Claude bio review, photo moderation, article generation
├── photos/                  sharp pipeline + storage helpers
├── stripe/                  Stripe SDK wrapper
├── email/                   Resend client + templates
├── porkbun/                 Porkbun API wrapper + register flow
├── vercel/                  Vercel domains API
├── lifecycle/               expiry, takedown finalization, GDPR
└── auth.ts                  getSession / requireUser / requireAdmin

supabase/
├── migrations/              0001 schema → 0002 RLS → 0003 pending_signups → 0004 lifecycle columns
└── storage.sql              photos bucket + RLS

middleware.ts                hostname → internal route rewrite

deprecated/cassius-blaze-jr/ Original static personal site — visual reference for personal-site design

scripts/
└── check-env.mjs            Verifies all .env.local keys connect to their services
```

## Data model (8 tables)

| Table | Purpose |
|---|---|
| `profiles` | One per customer. Subdomain, display_name, bio, status (`pending_moderation`/`live`/`taken_down`/`rejected`), expires_at, bespoke_domain |
| `articles` | News story per profile. slug, headline, subheadline, body, status, published_at |
| `photos` | Up to 5 per profile. storage_path, variants jsonb (hero/gallery/og/thumb URLs), is_primary, consent attestation |
| `social_links` | Up to 6 per profile. platform + value, sort_order |
| `payments` | Stripe sessions. tier (`base`/`bespoke_domain`), customer_id, subscription_id |
| `takedowns` | Audit log. requested_by (`customer`/`admin`/`expiry`/`gdpr`/`moderation`) |
| `tc_acceptances` | Legal trail. tc_version, dob, ip, user_agent, attestations |
| `name_collision_checks` | Cache of uniqueness verdicts (Google + Claude results) |
| `pending_signups` | Form payload stashed during Stripe Checkout (24h TTL) |

RLS on every table. Public can select `live` profiles + their related rows. Owner (`auth.uid() = user_id`) can CRUD their own. Service-role bypasses for backend writes.

## Signup → publish flow

The end-to-end happy path. Numbered steps map to real code paths.

1. Customer hits `theplaybook.site` (service site)
2. Clicks signup → 8-step wizard collects email, name uniqueness check, subdomain availability, bio, photos, social links
3. **On wizard mount**, `supabase.auth.signInAnonymously()` mints a `user_id`. Photos upload to Supabase Storage at `{user_id}/draft/{photo_uuid}.jpg` (RLS allows this because `auth.uid() = user_id`)
4. Customer clicks Pay → form posts to `POST /api/signup` → server validates with Zod → stashes payload in `pending_signups` → creates Stripe Checkout session with metadata `{ pending_signup_id, tier: 'base', user_id }` → returns `checkoutUrl`
5. Customer pays in Stripe-hosted checkout
6. Stripe fires `checkout.session.completed` → `POST /api/stripe/webhook` verifies signature, fans out via Inngest event `Events.SIGNUP_PAID { user_id, pending_signup_id, customer_email, ... }`
7. **Inngest workflow runs the publish pipeline** (`lib/inngest/functions/signup-paid.ts`):
   - Upgrade anonymous user to email-auth: `auth.admin.updateUserById(user_id, { email })` — same row gains an email, photos at `{user_id}/...` keep working
   - Process photos via sharp: hero (1200×800), gallery (800×800), og (1200×630), thumb (400×400), favicon (primary only) — all WebP, EXIF re-stripped, absolute URLs written to `photos.variants` jsonb
   - Moderate photos (Sightengine + TinEye in parallel) — soft-fail on API outage
   - Moderate bio via Claude
   - Generate news article via Claude (headline + subheadline + 250–400 word body, slug with collision-safe random suffix)
   - Insert profile + article + photos + social_links + tc_acceptance rows
   - **Status set to `pending_moderation`** — admin must approve to `live`
   - Send welcome email with embedded magic-link sign-in
   - `revalidateProfile()` ISR
8. Operator opens `theplaybook.site/admin/moderation` → sees pending profile → clicks Approve → fires `Events.PROFILE_UPDATED { changed_fields: [] }` (admin discriminates via `/api/moderate?action=approve`)
9. `profile-updated` workflow flips `profiles.status = 'live'`, `articles.status = 'live'`, sets `published_at = now()`, sends approval email, revalidates
10. Customer's article goes live at `thenorm.info/article/{slug}` and personal site at `{subdomain}.mybio.cloud`. Both pages have full SEO metadata + JSON-LD.

## Other flows

**Customer self-edit** — dashboard server actions update DB; if bio changed, status flips back to `pending_moderation`; `PROFILE_UPDATED` event triggers re-moderation + article regen.

**Takedown** — customer click → status flips → `TAKEDOWN_REQUESTED` event → agent 6 sends confirmation email + revalidates → agent 7's lifecycle worker schedules cooling-period cleanup.

**Daily cron** (`/api/cron/expire`, `/api/cron/takedown`, runs at 06:00 / 07:00 UTC) — finds expired profiles, fires takedown events; finds takedowns past `TAKEDOWN_COOLING_DAYS` (default 30), hard-deletes photos + child rows, anonymizes profile (preserves takedowns audit trail).

**GDPR delete** — admin-gated `POST /api/gdpr/delete` — full hard-delete bypassing cooling period.

**Bespoke domain upsell** — customer in dashboard clicks Upgrade → `/api/porkbun/check` returns available cheap-TLD options → customer picks → new Stripe checkout → webhook fires `BESPOKE_DOMAIN_REQUESTED` → agent 7 workflow registers domain, sets DNS, attaches to Vercel as redirect to subdomain, refunds on failure.

## Sub-agent ownership

The codebase was built by 7 parallel sub-agents working in disjoint file lanes against frozen contracts. Ownership map:

| Agent | Owns |
|---|---|
| 1 (foundation) | Schema, RLS, contracts, middleware, Supabase clients, db types |
| 2 (signup) | `app/service/signup/**`, `components/signup/**`, `app/api/uniqueness/check/route.ts` |
| 3 (news) | `app/news/**`, `components/news/**` |
| 4 (personal) | `app/personal/**`, `components/personal/**` |
| 5 (dashboards) | `app/service/{dashboard,admin,login,auth}/**`, `components/{dashboard,admin}/**`, `lib/auth.ts` |
| 6 (publishing pipeline) | `app/api/{signup,stripe,moderate,inngest}/**`, `lib/{inngest/functions/signup-paid,moderation,photos,email,stripe}/**` |
| 7 (lifecycle + bespoke) | `app/api/{cron,porkbun,gdpr}/**`, `lib/{lifecycle,porkbun,vercel}/**`, lifecycle Inngest functions |

**`lib/contracts/**` is FROZEN** — no agent edits it. Only the foundation agent updates it via explicit patch passes.

**`lib/inngest/functions/**` is shared** — agent 6 owns publish-pipeline handlers, agent 7 owns lifecycle handlers, both register via `app/api/inngest/route.ts`.

## External services

| Service | Used for | Required for v1? |
|---|---|---|
| Supabase | DB + auth + storage | **Yes** |
| Stripe | Payments | **Yes** |
| Anthropic | Claude bio review + article generation | **Yes** |
| Resend | Transactional email | **Yes** |
| Inngest | Workflow orchestration | **Yes** |
| Vercel | Hosting + cron | **Yes** |
| Sightengine | Photo NSFW moderation | No (admin reviews manually) |
| TinEye | Photo reverse-image search (stolen photos) | No |
| Google CSE | Name uniqueness search | No (Wikipedia + Claude work) |
| Porkbun | Bespoke domain registration | No (only if you sell bespoke tier) |
| Vercel API token | Attach bespoke domains | No (paired with Porkbun) |

## Status

System is feature-complete. All 7 sub-agents shipped + two follow-up passes. Foundation patched. `pnpm build` is green repo-wide.

**Outstanding:**
- Provision real services + paste keys into `.env.local` (in progress)
- Buy `theplaybook.site` and `mybio.cloud` (Porkbun)
- Deploy to Vercel + configure DNS + add domains to project
- Configure Stripe webhook endpoint (needs deployed URL)
- Verify Resend domain + switch `EMAIL_FROM` from `onboarding@resend.dev` to verified domain
- Contract gap: `tc_acceptances` table needs a `self_or_permission_attested` column (one-line migration; not blocking)
- Run integration smoke test (15-step plan in agent docs)
- T&C reviewed by lawyer (currently placeholder)

**Known small bugs:**
- The `check-env.mjs` Supabase anon-key test 401s with the new `sb_publishable_...` key format on bare `/rest/v1/profiles?limit=0` — still investigating. URL + service-role both verified working.

## Pre-launch checklist

1. ☐ Anthropic key (regenerate the leaked one)
2. ☐ Stripe Price ID (NOT product ID — must start with `price_...`)
3. ☐ Resend full-access key (not "sending only")
4. ☐ Buy `theplaybook.site` + `mybio.cloud`
5. ☐ Deploy to Vercel, add three domains
6. ☐ Configure DNS (Cloudflare or registrar): `thenorm.info` → Vercel; wildcard `*.mybio.cloud` → Vercel; `theplaybook.site` → Vercel
7. ☐ Stripe webhook endpoint at `theplaybook.site/api/stripe/webhook` with signing secret in env
8. ☐ Add `STRIPE_WEBHOOK_SECRET` to env once webhook configured
9. ☐ Verify Resend domain + update `EMAIL_FROM`
10. ☐ Test signup E2E (the 15-step smoke test)
11. ☐ Lawyer-review T&C
12. ☐ Decide: open signup or invite-only for first 10 customers (manual moderation will be slow)

## Conventions and gotchas

- **`lib/contracts/**` is frozen.** Adding fields requires a foundation patch, not a feature change.
- **Photos in `photos.variants` jsonb are always absolute URLs.** Agent 6 writes them this way; agent 4 + agent 3 read them. The `primaryPhotoUrl()` helper in `lib/contracts/profile.ts` falls back to composing absolute URL from `storage_path` if a variant URL is relative.
- **Subdomain edits are forbidden post-creation.** Changing it would break SEO + invalidate the article's outbound link.
- **Bio edits trigger re-moderation** (status flips to `pending_moderation`); tagline/social/photo edits don't.
- **Photo upload goes through the workflow, not the dashboard's server action.** Dashboard fires `PROFILE_UPDATED { changed_fields: ['photos'] }`; agent 6's handler runs moderation + variant generation.
- **Admin auth**: env var `ADMIN_EMAILS` (comma-separated). `lib/auth.ts:requireAdmin()` checks the magic-link user's email against the list.
- **`PROFILE_UPDATED` payload uses `changed_fields: string[]`** (not the original brief's `action: 'approved'|'rejected'|...`). Approve/reject moved to `/api/moderate?action=...` HTTP body discriminator. Recommend adding a separate event in the future.
- **Idempotency** — every Inngest step is independently retried; check before insert, use unique constraints, track sent flags.
- **Stripe webhook must return 200 fast** — webhook only verifies + fires Inngest event; all real work happens async.
- **Anonymous auth lifecycle**: wizard → `signInAnonymously()` → upload at `{user_id}/draft/...` → on payment, `auth.admin.updateUserById(user_id, { email, email_confirm: true })` upgrades the same row.
- **Cron auth**: `Authorization: Bearer ${CRON_SECRET}` with constant-time compare. 401 on unauth.

## Where to find things

| Looking for... | Path |
|---|---|
| Form schema (signup payload) | `lib/contracts/signup.ts` |
| Profile/article/photo types | `lib/contracts/profile.ts` |
| Inngest event names + payloads | `lib/contracts/events.ts` |
| Revalidation helpers | `lib/contracts/revalidation.ts` |
| DB row types | `lib/types/db.ts` |
| Migration files | `supabase/migrations/` (in numerical order) |
| Storage RLS | `supabase/storage.sql` |
| Hostname routing | `middleware.ts` |
| Supabase clients | `lib/supabase/{server,client,middleware,admin}.ts` |
| Auth helpers | `lib/auth.ts` |
| Signup workflow | `lib/inngest/functions/signup-paid.ts` |
| Photo processing | `lib/photos/process.ts` |
| Bio moderation | `lib/moderation/bio.ts` |
| Article generation | `lib/moderation/article.ts` |
| Personal site template | `app/personal/[subdomain]/page.tsx` |
| News article template | `app/news/article/[slug]/page.tsx` |
| Customer dashboard | `app/service/dashboard/**` |
| Admin dashboard | `app/service/admin/**` |
| Cron handlers | `app/api/cron/**` |
| Bespoke domain flow | `lib/inngest/functions/bespoke-domain.ts` + `lib/porkbun/**` |
| Visual reference for personal sites | `deprecated/cassius-blaze-jr/index.html` |
| Env var template | `.env.example` |
| Env connectivity test | `scripts/check-env.mjs` (run with `node --env-file=.env.local scripts/check-env.mjs`) |
