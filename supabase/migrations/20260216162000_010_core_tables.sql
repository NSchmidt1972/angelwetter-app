-- Multi-tenant baseline: core schema

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  host text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  role text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (id, club_id),
  constraint profiles_role_check check (
    role is null or role in ('mitglied', 'vorstand', 'admin', 'gast', 'tester', 'inactive')
  )
);

create table if not exists public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  role text not null default 'mitglied',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, club_id),
  constraint memberships_role_check check (
    role in ('mitglied', 'vorstand', 'admin', 'gast', 'tester', 'inactive')
  )
);

create table if not exists public.superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.whitelist_emails (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  email citext not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint whitelist_emails_email_club_unique unique (email, club_id)
);

create table if not exists public.fishes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  angler text,
  fish text,
  size numeric,
  weight numeric,
  note text,
  timestamp timestamptz not null default timezone('utc', now()),
  weather jsonb default '{}'::jsonb,
  photo_url text,
  blank boolean not null default false,
  taken boolean not null default false,
  location_name text,
  lat double precision,
  lon double precision,
  is_marilou boolean not null default false,
  count_in_stats boolean not null default true,
  under_min_size boolean not null default false,
  out_of_season boolean not null default false,
  hours integer,
  fishing_type text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fishes_hours_non_negative check (hours is null or hours >= 0)
);

create table if not exists public.crayfish_catches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  angler text,
  species text not null,
  count integer not null,
  catch_timestamp timestamptz not null default timezone('utc', now()),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crayfish_count_positive check (count > 0)
);

create table if not exists public.user_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  angler_name text,
  last_active timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, club_id)
);

create table if not exists public.push_subscriptions (
  subscription_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  angler_name text,
  scope text,
  device_label text,
  user_agent text,
  opted_in boolean not null default true,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  path text not null,
  full_path text,
  angler text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.fish_reactions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  fish_id uuid not null references public.fishes(id) on delete cascade,
  user_name text not null,
  reaction text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fish_reactions_unique_per_user unique (fish_id, user_name)
);

create table if not exists public.weather_cache (
  club_id uuid not null references public.clubs(id) on delete cascade,
  id text not null default 'latest',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (club_id, id)
);

create table if not exists public.weather_log (
  id bigserial primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  timestamp timestamptz not null default timezone('utc', now()),
  temp double precision,
  pressure double precision,
  humidity double precision,
  wind double precision,
  wind_deg double precision,
  moon_phase double precision,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.weather_summary (
  id bigserial primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  angler text,
  caught_at timestamptz not null default timezone('utc', now()),
  timestamp timestamptz not null default timezone('utc', now()),
  temp double precision,
  pressure double precision,
  humidity double precision,
  wind_speed double precision,
  wind_deg double precision,
  moon_phase double precision,
  summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists clubs_slug_idx on public.clubs (slug);
create index if not exists profiles_club_id_idx on public.profiles (club_id);
create index if not exists profiles_name_idx on public.profiles (name);
create index if not exists memberships_club_role_idx on public.memberships (club_id, role) where is_active = true;
create index if not exists whitelist_emails_club_idx on public.whitelist_emails (club_id);
create index if not exists fishes_club_timestamp_idx on public.fishes (club_id, timestamp desc);
create index if not exists fishes_club_angler_idx on public.fishes (club_id, angler);
create index if not exists crayfish_catches_club_timestamp_idx on public.crayfish_catches (club_id, catch_timestamp desc);
create index if not exists user_activity_club_last_active_idx on public.user_activity (club_id, last_active desc);
create index if not exists push_subscriptions_club_idx on public.push_subscriptions (club_id);
create index if not exists push_subscriptions_user_club_idx on public.push_subscriptions (user_id, club_id);
create index if not exists page_views_club_created_at_idx on public.page_views (club_id, created_at desc);
create index if not exists page_views_created_at_brin_idx on public.page_views using brin (created_at);
create index if not exists fish_reactions_club_fish_idx on public.fish_reactions (club_id, fish_id);
create index if not exists weather_log_club_timestamp_idx on public.weather_log (club_id, timestamp desc);
create index if not exists weather_summary_club_timestamp_idx on public.weather_summary (club_id, timestamp desc);

-- updated_at triggers

drop trigger if exists t_set_updated_at_clubs on public.clubs;
create trigger t_set_updated_at_clubs
before update on public.clubs
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_profiles on public.profiles;
create trigger t_set_updated_at_profiles
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_memberships on public.memberships;
create trigger t_set_updated_at_memberships
before update on public.memberships
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_whitelist_emails on public.whitelist_emails;
create trigger t_set_updated_at_whitelist_emails
before update on public.whitelist_emails
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_fishes on public.fishes;
create trigger t_set_updated_at_fishes
before update on public.fishes
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_crayfish_catches on public.crayfish_catches;
create trigger t_set_updated_at_crayfish_catches
before update on public.crayfish_catches
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_user_activity on public.user_activity;
create trigger t_set_updated_at_user_activity
before update on public.user_activity
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_push_subscriptions on public.push_subscriptions;
create trigger t_set_updated_at_push_subscriptions
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_fish_reactions on public.fish_reactions;
create trigger t_set_updated_at_fish_reactions
before update on public.fish_reactions
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_weather_summary on public.weather_summary;
create trigger t_set_updated_at_weather_summary
before update on public.weather_summary
for each row execute function public.set_updated_at();

-- user_id auto-fill triggers

drop trigger if exists t_set_user_id_if_missing_fishes on public.fishes;
create trigger t_set_user_id_if_missing_fishes
before insert on public.fishes
for each row execute function public.set_user_id_if_missing();

drop trigger if exists t_set_user_id_if_missing_crayfish on public.crayfish_catches;
create trigger t_set_user_id_if_missing_crayfish
before insert on public.crayfish_catches
for each row execute function public.set_user_id_if_missing();
