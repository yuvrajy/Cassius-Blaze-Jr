-- 0004_lifecycle_columns.sql
-- All lifecycle bookkeeping columns and the indexes the daily crons hit.
-- Consolidated from sub-agent 1's 0003 + sub-agent 7's original 0004.
--
-- Columns
--   profiles.expiry_warning_sent_at         set by the expiry cron once a
--     "your site expires soon" email has gone out, so retries don't double-
--     send.
--   profiles.takedown_finalized_at          set by the takedown cron once
--     the cooled-off takedown has been hard-deleted; gates re-finalization.
--   profiles.bespoke_domain_email_sent_at   set when the "your custom
--     domain is live" email has been delivered.
--   payments.bespoke_domain_chosen          customer's chosen apex at
--     checkout, kept on the payment row so the BESPOKE_DOMAIN_REQUESTED
--     handler can recover it if Stripe metadata is missing.
--
-- All columns are nullable; presence/absence is the state.

alter table profiles
  add column if not exists expiry_warning_sent_at      timestamptz,
  add column if not exists takedown_finalized_at       timestamptz,
  add column if not exists bespoke_domain_email_sent_at timestamptz;

alter table payments
  add column if not exists bespoke_domain_chosen text;

-- Indexes for the daily crons. Both predicates exclude rows that the cron
-- doesn't care about, keeping the indexes small.
create index if not exists profiles_expires_at_idx
  on profiles(expires_at);

create index if not exists profiles_taken_down_finalized_idx
  on profiles(takedown_finalized_at) where status = 'taken_down';
