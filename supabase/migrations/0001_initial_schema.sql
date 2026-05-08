-- 0001_initial_schema.sql
-- Core schema for getknown.
--
-- Tables:
--   profiles               — one row per customer subdomain (sarah-chen.iam.bio)
--   articles               — one row per news article on thenorm.info
--   photos                 — uploaded portrait photos with consent log
--   social_links           — links shown on the personal site
--   payments               — Stripe payment / subscription records
--   takedowns              — audit log of all takedown actions
--   tc_acceptances         — terms acceptance + DOB attestation
--   name_collision_checks  — cached results of "is this name unique enough"
--
-- RLS is enabled in 0002_rls.sql; do not query these tables from the public
-- (anon) role until that migration has run.

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subdomain text unique not null,
  display_name text not null,
  tagline text,
  bio text not null,
  status text not null default 'pending_moderation'
    check (status in ('pending_moderation','live','taken_down','rejected')),
  bespoke_domain text,
  moderation_notes text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_status_idx on profiles(status);
create index profiles_user_id_idx on profiles(user_id);

create table articles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  slug text unique not null,
  headline text not null,
  subheadline text,
  body text not null,
  author_name text not null default 'The Norm Staff',
  status text not null default 'pending_moderation'
    check (status in ('pending_moderation','live','taken_down')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_slug_idx on articles(slug);
create index articles_status_idx on articles(status);

create table photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  variants jsonb not null default '{}'::jsonb,
  is_primary boolean not null default false,
  sort_order int not null default 0,
  consent_logged boolean not null default false,
  consent_ip text,
  consent_user_agent text,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);
create index photos_profile_id_idx on photos(profile_id);
-- enforce at most one primary photo per profile
create unique index photos_one_primary_per_profile
  on photos(profile_id) where is_primary = true;

create table social_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  platform text not null
    check (platform in ('twitter','instagram','linkedin','github','tiktok','youtube','email','website')),
  value text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index social_links_profile_id_idx on social_links(profile_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  stripe_session_id text unique,
  stripe_subscription_id text,
  stripe_customer_id text,
  amount_cents int not null,
  currency text not null default 'usd',
  tier text not null check (tier in ('base','bespoke_domain')),
  status text not null,
  created_at timestamptz not null default now()
);
create index payments_user_id_idx on payments(user_id);
create index payments_subscription_idx on payments(stripe_subscription_id);

create table takedowns (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  reason text,
  requested_by text not null
    check (requested_by in ('customer','admin','expiry','gdpr','moderation')),
  created_at timestamptz not null default now()
);

create table tc_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  tc_version text not null,
  ip_address text not null,
  user_agent text not null,
  dob date not null,
  accepted_at timestamptz not null default now()
);

create table name_collision_checks (
  id uuid primary key default gen_random_uuid(),
  name_normalized text unique not null,
  severity int not null check (severity between 0 and 5),
  evidence jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger articles_updated_at before update on articles
  for each row execute function set_updated_at();
