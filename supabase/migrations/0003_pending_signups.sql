-- 0003_pending_signups.sql
-- Stash for the signup form payload between POST /api/signup and the
-- Stripe webhook. Lifecycle:
--   1. POST /api/signup re-validates the SignupInput, inserts a row here
--      with the full Zod-validated payload as JSONB, then creates a Stripe
--      Checkout session whose metadata carries pending_signup_id.
--   2. On checkout.session.completed the webhook fires SIGNUP_PAID; the
--      Inngest workflow loads this row, runs the publish pipeline, then
--      deletes it.
--   3. Rows older than expires_at can be GC'd by agent 7's cron — they
--      represent users who never finished checkout.
--
-- The payload column intentionally stores the *raw* SignupInput (including
-- storage_path references to draft photos). It is not a substitute for the
-- profiles/photos rows; those are written by the workflow once paid.

create table pending_signups (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index pending_signups_expires_at_idx on pending_signups(expires_at);

-- RLS: service-role only. No public, anon, or authenticated access.
alter table pending_signups enable row level security;
-- (no policies → only the service-role key bypasses RLS and can read/write)
