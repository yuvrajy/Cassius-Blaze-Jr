-- 0004_lifecycle_columns.sql
-- Adds the one lifecycle column not already present in 0003:
--
-- profiles.bespoke_domain_email_sent_at  stamped when the "your custom
--                                        domain is live" email has been
--                                        delivered, so Inngest retries
--                                        don't re-send.
--
-- The other lifecycle columns (expiry_warning_sent_at, takedown_finalized_at,
-- payments.bespoke_domain_chosen) were already added in 0003_lifecycle_columns.sql.
-- This migration also adds two indexes used by the daily crons.

alter table profiles
  add column if not exists bespoke_domain_email_sent_at timestamptz;

create index if not exists profiles_expires_at_idx
  on profiles(expires_at);
create index if not exists profiles_taken_down_finalized_idx
  on profiles(takedown_finalized_at) where status = 'taken_down';
