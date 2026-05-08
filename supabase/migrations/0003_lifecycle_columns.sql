-- 0003_lifecycle_columns.sql
-- Lifecycle bookkeeping columns. Used by:
--   * sub-agent 7's expiry cron — set when a "your site expires soon"
--     warning email goes out, so we don't send the same warning twice.
--   * sub-agent 7's takedown finalization cron — set when the cooled-off
--     takedown has been hard-deleted, so we never re-finalize a row.
--
-- Both columns are nullable; presence/absence is the state.

alter table profiles
  add column if not exists expiry_warning_sent_at timestamptz,
  add column if not exists takedown_finalized_at  timestamptz;

-- For the bespoke-domain upsell: store the customer's chosen domain on the
-- payment row at checkout time so the BESPOKE_DOMAIN_REQUESTED Inngest
-- handler can pick it up if Stripe metadata is missing.
alter table payments
  add column if not exists bespoke_domain_chosen text;
