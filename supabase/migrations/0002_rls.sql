-- 0002_rls.sql
-- Row Level Security policies.
--
-- Visibility rules:
--   * profiles, articles, photos, social_links — publicly readable iff the
--     parent profile/article is `live`. Owners see and mutate their own rows
--     in any state.
--   * payments, takedowns, tc_acceptances — owner can read their own rows
--     only. No public access. Service-role bypasses RLS for all writes.
--   * name_collision_checks — server-only cache; no public, owner reads via
--     service-role only.
--
-- The service-role key bypasses RLS by default in Supabase, so background
-- workers (Inngest, cron) and admin tooling do not need policies of their own.

-- =====================================================================
-- profiles
-- =====================================================================
alter table profiles enable row level security;

-- public can read live profiles (used by the personal-site renderer
-- when it loads /personal/[subdomain] from the DB)
create policy profiles_public_read_live on profiles
  for select using (status = 'live');

-- the owner can read their own profile in any state (dashboard view)
create policy profiles_owner_read on profiles
  for select using (auth.uid() = user_id);

-- the owner can insert a profile that belongs to them
create policy profiles_owner_insert on profiles
  for insert with check (auth.uid() = user_id);

-- the owner can update their own profile (status/moderation_notes
-- are still owner-writable; the application layer is responsible for
-- preventing the user from flipping their own row to 'live')
create policy profiles_owner_update on profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- the owner can delete (= request deletion of) their own profile
create policy profiles_owner_delete on profiles
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- articles
-- =====================================================================
alter table articles enable row level security;

-- public can read live articles
create policy articles_public_read_live on articles
  for select using (status = 'live');

-- owner (= the profile owner) can read their own articles in any state
create policy articles_owner_read on articles
  for select using (
    exists (select 1 from profiles p where p.id = articles.profile_id and p.user_id = auth.uid())
  );

-- articles are written by the service role only (the Claude-generated
-- article pipeline runs server-side). No owner write policy on purpose.

-- =====================================================================
-- photos
-- =====================================================================
alter table photos enable row level security;

-- public can read photos belonging to live profiles (the personal-site
-- renderer loads these when rendering portrait galleries)
create policy photos_public_read_live on photos
  for select using (
    exists (select 1 from profiles p where p.id = photos.profile_id and p.status = 'live')
  );

-- owner can read all their photos (including pre-moderation)
create policy photos_owner_read on photos
  for select using (
    exists (select 1 from profiles p where p.id = photos.profile_id and p.user_id = auth.uid())
  );

-- owner can insert/update/delete their own photo rows
create policy photos_owner_insert on photos
  for insert with check (
    exists (select 1 from profiles p where p.id = photos.profile_id and p.user_id = auth.uid())
  );
create policy photos_owner_update on photos
  for update using (
    exists (select 1 from profiles p where p.id = photos.profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from profiles p where p.id = photos.profile_id and p.user_id = auth.uid())
  );
create policy photos_owner_delete on photos
  for delete using (
    exists (select 1 from profiles p where p.id = photos.profile_id and p.user_id = auth.uid())
  );

-- =====================================================================
-- social_links
-- =====================================================================
alter table social_links enable row level security;

-- public can read social links belonging to live profiles
create policy social_links_public_read_live on social_links
  for select using (
    exists (select 1 from profiles p where p.id = social_links.profile_id and p.status = 'live')
  );

-- owner can full CRUD their own profile's links
create policy social_links_owner_read on social_links
  for select using (
    exists (select 1 from profiles p where p.id = social_links.profile_id and p.user_id = auth.uid())
  );
create policy social_links_owner_insert on social_links
  for insert with check (
    exists (select 1 from profiles p where p.id = social_links.profile_id and p.user_id = auth.uid())
  );
create policy social_links_owner_update on social_links
  for update using (
    exists (select 1 from profiles p where p.id = social_links.profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from profiles p where p.id = social_links.profile_id and p.user_id = auth.uid())
  );
create policy social_links_owner_delete on social_links
  for delete using (
    exists (select 1 from profiles p where p.id = social_links.profile_id and p.user_id = auth.uid())
  );

-- =====================================================================
-- payments
-- =====================================================================
alter table payments enable row level security;

-- owner can read their own payments (dashboard "billing history")
create policy payments_owner_read on payments
  for select using (auth.uid() = user_id);

-- writes are service-role only (Stripe webhook handler runs as service role)

-- =====================================================================
-- takedowns
-- =====================================================================
alter table takedowns enable row level security;

-- owner can read their own takedown audit entries (transparency)
create policy takedowns_owner_read on takedowns
  for select using (
    exists (select 1 from profiles p where p.id = takedowns.profile_id and p.user_id = auth.uid())
  );

-- writes are service-role only (admin/cron/customer-portal flows)

-- =====================================================================
-- tc_acceptances
-- =====================================================================
alter table tc_acceptances enable row level security;

-- owner can read their own acceptance records
create policy tc_acceptances_owner_read on tc_acceptances
  for select using (auth.uid() = user_id);

-- writes are service-role only (recorded by the signup API on form post)

-- =====================================================================
-- name_collision_checks
-- =====================================================================
alter table name_collision_checks enable row level security;

-- no policies → no access for anon / authenticated. service-role only.
-- (this is a server-side cache; clients never read or write it directly)
