# getknown

A service that helps people get found on the internet for their own name.
A customer pays, fills out a form (bio, photos, social links), and we
generate three things on their behalf:

1. A news-style article about them on our editorial site, **thenorm.info**.
2. A personal site at a subdomain like **sarah-chen.iam.bio**.
3. (Paid upsell) A bespoke domain like **sarahchen.xyz** that 301s to the
   subdomain.

Our job is to wire the SEO, metadata, and cross-linking so they rank.

## Architecture: one repo, one Next.js app, three hostnames

Three hostnames map to three page trees inside the same Next.js app via
[`middleware.ts`](./middleware.ts):

| Hostname        | Site                          | Internal route prefix           |
| --------------- | ----------------------------- | ------------------------------- |
| `thenorm.info`  | News site (editorial)         | `/news/...`                     |
| `*.iam.bio`     | Personal sites, multi-tenant  | `/personal/[subdomain]/...`     |
| `getknown.com`  | Marketing + signup + dashboard| `/service/...`                  |

`getknown.com` and `iam.bio` are placeholder domains held in env vars
(`NEXT_PUBLIC_SERVICE_DOMAIN`, `NEXT_PUBLIC_PARENT_DOMAIN`).
`thenorm.info` is locked.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind v4 + shadcn/ui
- Supabase (Postgres + Auth + Storage)
- Inngest (background workflows)
- Stripe (payments), Resend (email), Claude API (content gen + bio review)
- Sightengine + TinEye (photo moderation), Google CSE (name uniqueness)
- Porkbun (bespoke domain registration), Vercel (hosting + domains API)
- pnpm
- Deploys to Vercel

## Local dev

```bash
pnpm install
cp .env.example .env.local      # fill in values
pnpm dev
```

The dev server runs on `localhost:3000`. To exercise hostname routing
locally, add hosts-file aliases in `/etc/hosts`:

```
127.0.0.1   thenorm.local
127.0.0.1   sarah.parent.local
127.0.0.1   getknown.local
```

Then run `NEXT_PUBLIC_HUB_DOMAIN=thenorm.local NEXT_PUBLIC_PARENT_DOMAIN=parent.local pnpm dev`.

Visit:
- `http://thenorm.local:3000/` → renders `/news`
- `http://sarah.parent.local:3000/` → renders `/personal/sarah`
- `http://getknown.local:3000/` → renders `/service`

### Database

Apply migrations against your Supabase project:

```bash
supabase link --project-ref <ref>
supabase db push                                        # 0001 + 0002
psql "$SUPABASE_DB_URL" -f supabase/storage.sql         # photos bucket + RLS
```

### Regenerate DB types

After a schema change, regenerate `lib/types/db.ts` so all sub-agents see
the new shape:

```bash
pnpm dlx supabase gen types typescript \
  --project-id "$SUPABASE_PROJECT_ID" --schema public \
  > lib/types/db.ts
```

## How parallel agents work

Six agents (2–7) build the rest of the system in parallel. They never
collide because each owns a distinct file lane and codes against the
**frozen contracts** in [`lib/contracts/`](./lib/contracts/). The contract
directory is sub-agent 1's deliverable; everyone else imports from it but
never edits it. If a downstream agent finds a contract gap, they stop and
report — sub-agent 1 (or a human) updates the contract before they resume.

## File ownership map

Each agent **writes only** in their `Owns` column and **reads only** from
the `Reads` column. Cross-lane writes are a contract violation.

| Agent | Owns (writes)                                                                                                                                                  | Reads only                                                            |
|------:|----------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| **1** | (this scaffold) `app/{layout.tsx,globals.css}`, `middleware.ts`, `supabase/**`, `lib/{contracts,supabase,types}/**`, `components/ui/**`, `.env.example`, README | —                                                                     |
| **2** | `app/service/page.tsx`, `app/service/signup/**`, `components/signup/**`                                                                                        | `lib/contracts/`, `lib/supabase/`                                     |
| **3** | `app/news/**`, `components/news/**`                                                                                                                            | `lib/contracts/`, `lib/supabase/`                                     |
| **4** | `app/personal/**`, `components/personal/**`                                                                                                                    | `lib/contracts/`, `lib/supabase/`, `deprecated/`                      |
| **5** | `app/service/{dashboard,admin,login}/**`, `components/{dashboard,admin}/**`                                                                                    | `lib/contracts/`, `lib/supabase/`                                     |
| **6** | `app/api/{signup,stripe,moderate,inngest}/**`, `lib/{inngest,moderation,photos,email}/**`                                                                      | `lib/contracts/`, `lib/supabase/`                                     |
| **7** | `app/api/{cron,porkbun}/**`, `lib/{porkbun,lifecycle}/**`                                                                                                       | `lib/contracts/`, `lib/supabase/`                                     |

Sub-agent 1 prepopulated the news layout (`app/news/layout.tsx`) and the
news components in `components/news/` to give sub-agent 3 a working
starting point. Sub-agent 3 owns those files and is free to replace them.

## Folder layout

```
app/
├── layout.tsx                  root layout (sub-agent 1)
├── globals.css                 shadcn theme + tailwind
├── news/                       (agent 3) — wraps to thenorm.info
├── personal/[subdomain]/       (agent 4) — wraps to *.iam.bio
├── service/                    (agent 2 + 5) — wraps to getknown.com
└── api/
    ├── health/                 liveness probe (agent 1)
    ├── signup, stripe,
    ├── moderate, inngest/      (agent 6 stubs returning 501)
    ├── cron/{expire,takedown}/ (agent 7 stubs)
    └── porkbun/                (agent 7 stubs)

components/
├── ui/                         shadcn components (agent 1)
└── news/                       (agent 3 — pre-populated by agent 1)

lib/
├── contracts/                  FROZEN — agent 1 only
│   ├── signup.ts               Zod schema for signup payload
│   ├── profile.ts              Joined profile/article shapes + helpers
│   ├── moderation.ts           Bio / photo / collision verdict shapes
│   ├── events.ts               Inngest event names + payloads
│   ├── revalidation.ts         Cross-site URL builders + revalidate helper
│   └── README.md               Producer/consumer matrix
├── supabase/                   typed clients in 4 contexts (agent 1)
│   ├── server.ts               RSC / route-handler
│   ├── client.ts               browser ('use client')
│   ├── middleware.ts           session-refresh helper
│   └── admin.ts                service-role (server-only)
├── types/
│   └── db.ts                   hand-written Database types (regen-ready)
└── utils.ts                    shadcn cn() helper

supabase/
├── migrations/
│   ├── 0001_initial_schema.sql 8 tables + updated_at trigger
│   └── 0002_rls.sql            RLS policies
└── storage.sql                 photos bucket + per-user write policy

middleware.ts                   hostname → internal-route rewrites

deprecated/cassius-blaze-jr/    original static personal site —
                                visual reference for sub-agent 4
```

## Scripts

```bash
pnpm dev          # dev server (turbopack)
pnpm build        # production build (webpack — turbopack has a font-bundler bug)
pnpm start        # serve the build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
```

## `deprecated/`

Holds the original static personal site that inspired this product
(`cassius-blaze-jr.com`, the predecessor of the multi-tenant builder).
Sub-agent 4 (personal sites factory) should consult its layout and
typography. **Not active code** — never import from it.
