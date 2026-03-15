-- Live RLS/permission hardening for project kirevrwmmthqgceprbhl
-- Goal: remove broad PUBLIC policies and anon write/function access.

begin;

-- Helper: remove all existing policies from a table.
create or replace function public.__drop_all_policies(p_table text)
returns void
language plpgsql
set search_path = public
as $$
declare
  p record;
begin
  if to_regclass(format('public.%I', p_table)) is null then
    return;
  end if;

  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = p_table
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p_table);
  end loop;
end;
$$;

select public.__drop_all_policies('analytics_events');
select public.__drop_all_policies('batt_log');
select public.__drop_all_policies('clubs');
select public.__drop_all_policies('comments');
select public.__drop_all_policies('crayfish_catches');
select public.__drop_all_policies('fish_reactions');
select public.__drop_all_policies('fishes');
select public.__drop_all_policies('gps_log');
select public.__drop_all_policies('likes');
select public.__drop_all_policies('memberships');
select public.__drop_all_policies('page_views');
select public.__drop_all_policies('profiles');
select public.__drop_all_policies('push_errors');
select public.__drop_all_policies('push_subscriptions');
select public.__drop_all_policies('superadmins');
select public.__drop_all_policies('temperature_log');
select public.__drop_all_policies('user_activity');
select public.__drop_all_policies('weather_cache');
select public.__drop_all_policies('weather_log');
select public.__drop_all_policies('weather_summary');
select public.__drop_all_policies('whitelist_emails');

drop function if exists public.__drop_all_policies(text);

-- Helper functions used in policies.
create or replace function public.current_profile_name(p_club_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.name
  from public.profiles p
  where p.id = auth.uid()
    and p.club_id = p_club_id
  limit 1;
$$;

create or replace function public.is_profile_owner_name(p_club_id uuid, p_angler text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.club_id = p_club_id
      and lower(trim(coalesce(p.name, ''))) = lower(trim(coalesce(p_angler, '')))
  );
$$;

create or replace function public.is_email_whitelisted(p_email text, p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.whitelist_emails w
    where w.club_id = p_club_id
      and lower(trim(coalesce(w.email::text, ''))) = lower(trim(coalesce(p_email, '')))
  );
$$;

create or replace function public.is_any_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_superadmin()
    or exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active = true
        and m.role::text in ('admin', 'vorstand')
    );
$$;

grant usage on schema public to anon, authenticated, service_role;

-- Lock down anon role broadly, then allow only explicit public paths.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;

grant select on table public.clubs to anon;
grant execute on function public.is_email_whitelisted(text, uuid) to anon;

-- Ensure intended function execute grants.
grant execute on function public.is_superadmin() to authenticated, service_role;
grant execute on function public.is_club_member(uuid) to authenticated, service_role;
grant execute on function public.is_club_admin(uuid) to authenticated, service_role;
grant execute on function public.current_profile_name(uuid) to authenticated, service_role;
grant execute on function public.is_profile_owner_name(uuid, text) to authenticated, service_role;
grant execute on function public.is_email_whitelisted(text, uuid) to authenticated, service_role;
grant execute on function public.is_any_admin() to authenticated, service_role;
grant execute on function public.admin_page_view_years(uuid, text) to authenticated;
grant execute on function public.admin_page_view_monthly_counts(uuid, integer, text) to authenticated;

-- Keep RLS enabled explicitly.
alter table if exists public.analytics_events enable row level security;
alter table if exists public.batt_log enable row level security;
alter table if exists public.clubs enable row level security;
alter table if exists public.comments enable row level security;
alter table if exists public.crayfish_catches enable row level security;
alter table if exists public.fish_reactions enable row level security;
alter table if exists public.fishes enable row level security;
alter table if exists public.gps_log enable row level security;
alter table if exists public.likes enable row level security;
alter table if exists public.memberships enable row level security;
alter table if exists public.page_views enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.push_errors enable row level security;
alter table if exists public.push_subscriptions enable row level security;
alter table if exists public.superadmins enable row level security;
alter table if exists public.temperature_log enable row level security;
alter table if exists public.user_activity enable row level security;
alter table if exists public.weather_cache enable row level security;
alter table if exists public.weather_log enable row level security;
alter table if exists public.weather_summary enable row level security;
alter table if exists public.whitelist_emails enable row level security;

-- clubs
create policy clubs_public_select
on public.clubs
for select
to anon, authenticated
using (true);

create policy clubs_superadmin_manage
on public.clubs
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

-- profiles
create policy profiles_select
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_club_admin(club_id)
  or public.is_superadmin()
);

create policy profiles_insert
on public.profiles
for insert
to authenticated
with check (
  public.is_superadmin()
  or (
    auth.uid() = id
    and public.is_email_whitelisted(coalesce(auth.jwt() ->> 'email', ''), club_id)
  )
);

create policy profiles_update
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.is_club_admin(club_id)
  or public.is_superadmin()
)
with check (
  auth.uid() = id
  or public.is_club_admin(club_id)
  or public.is_superadmin()
);

create policy profiles_delete
on public.profiles
for delete
to authenticated
using (
  public.is_club_admin(club_id)
  or public.is_superadmin()
);

-- memberships
create policy memberships_select
on public.memberships
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_club_admin(club_id)
  or public.is_superadmin()
);

create policy memberships_insert
on public.memberships
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or (
    auth.uid() = user_id
    and is_active = true
    and role::text in ('mitglied', 'gast', 'tester')
    and public.is_email_whitelisted(coalesce(auth.jwt() ->> 'email', ''), club_id)
  )
);

create policy memberships_update
on public.memberships
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy memberships_delete
on public.memberships
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

-- superadmins
create policy superadmins_select
on public.superadmins
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_superadmin()
);

create policy superadmins_manage
on public.superadmins
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

-- whitelist_emails
create policy whitelist_select
on public.whitelist_emails
for select
to authenticated
using (
  public.is_club_admin(club_id)
  or public.is_superadmin()
);

create policy whitelist_insert
on public.whitelist_emails
for insert
to authenticated
with check (
  public.is_club_admin(club_id)
  or public.is_superadmin()
);

create policy whitelist_update
on public.whitelist_emails
for update
to authenticated
using (
  public.is_club_admin(club_id)
  or public.is_superadmin()
)
with check (
  public.is_club_admin(club_id)
  or public.is_superadmin()
);

create policy whitelist_delete
on public.whitelist_emails
for delete
to authenticated
using (
  public.is_club_admin(club_id)
  or public.is_superadmin()
);

-- fishes
create policy fishes_select
on public.fishes
for select
to authenticated
using (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

create policy fishes_insert
on public.fishes
for insert
to authenticated
with check (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

create policy fishes_update
on public.fishes
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or public.is_profile_owner_name(club_id, angler)
)
with check (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

create policy fishes_delete
on public.fishes
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or public.is_profile_owner_name(club_id, angler)
);

-- crayfish_catches
create policy crayfish_select
on public.crayfish_catches
for select
to authenticated
using (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

create policy crayfish_insert
on public.crayfish_catches
for insert
to authenticated
with check (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

create policy crayfish_update
on public.crayfish_catches
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or public.is_profile_owner_name(club_id, angler)
)
with check (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

create policy crayfish_delete
on public.crayfish_catches
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or public.is_profile_owner_name(club_id, angler)
);

-- user_activity
create policy user_activity_select
on public.user_activity
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or auth.uid() = user_id
);

create policy user_activity_insert
on public.user_activity
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or (auth.uid() = user_id and public.is_club_member(club_id))
);

create policy user_activity_update
on public.user_activity
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or auth.uid() = user_id
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or (auth.uid() = user_id and public.is_club_member(club_id))
);

create policy user_activity_delete
on public.user_activity
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

-- push_subscriptions
create policy push_subscriptions_select
on public.push_subscriptions
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or auth.uid() = user_id
);

create policy push_subscriptions_insert
on public.push_subscriptions
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or (auth.uid() = user_id and public.is_club_member(club_id))
);

create policy push_subscriptions_update
on public.push_subscriptions
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or auth.uid() = user_id
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or (auth.uid() = user_id and public.is_club_member(club_id))
);

create policy push_subscriptions_delete
on public.push_subscriptions
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or auth.uid() = user_id
);

-- page_views
create policy page_views_select
on public.page_views
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy page_views_insert
on public.page_views
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

-- analytics_events
create policy analytics_events_select
on public.analytics_events
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy analytics_events_insert
on public.analytics_events
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

create policy analytics_events_update
on public.analytics_events
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy analytics_events_delete
on public.analytics_events
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

-- weather tables
create policy weather_cache_select
on public.weather_cache
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

create policy weather_cache_insert
on public.weather_cache
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_cache_update
on public.weather_cache
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_cache_delete
on public.weather_cache
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_log_select
on public.weather_log
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_log_insert
on public.weather_log
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_log_update
on public.weather_log
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_log_delete
on public.weather_log
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_summary_select
on public.weather_summary
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_summary_insert
on public.weather_summary
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_summary_update
on public.weather_summary
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create policy weather_summary_delete
on public.weather_summary
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

-- fish_reactions (no club_id column in legacy schema -> derive via fishes)
create policy fish_reactions_select
on public.fish_reactions
for select
to authenticated
using (
  public.is_superadmin()
  or exists (
    select 1
    from public.fishes f
    where f.id = fish_reactions.fish_id
      and public.is_club_member(f.club_id)
  )
);

create policy fish_reactions_insert
on public.fish_reactions
for insert
to authenticated
with check (
  public.is_superadmin()
  or exists (
    select 1
    from public.fishes f
    where f.id = fish_reactions.fish_id
      and public.is_club_member(f.club_id)
      and lower(trim(fish_reactions.user_name)) = lower(trim(coalesce(public.current_profile_name(f.club_id), '')))
  )
);

create policy fish_reactions_update
on public.fish_reactions
for update
to authenticated
using (
  public.is_superadmin()
  or exists (
    select 1
    from public.fishes f
    where f.id = fish_reactions.fish_id
      and (
        public.is_club_admin(f.club_id)
        or lower(trim(fish_reactions.user_name)) = lower(trim(coalesce(public.current_profile_name(f.club_id), '')))
      )
  )
)
with check (
  public.is_superadmin()
  or exists (
    select 1
    from public.fishes f
    where f.id = fish_reactions.fish_id
      and (
        public.is_club_admin(f.club_id)
        or (
          public.is_club_member(f.club_id)
          and lower(trim(fish_reactions.user_name)) = lower(trim(coalesce(public.current_profile_name(f.club_id), '')))
        )
      )
  )
);

create policy fish_reactions_delete
on public.fish_reactions
for delete
to authenticated
using (
  public.is_superadmin()
  or exists (
    select 1
    from public.fishes f
    where f.id = fish_reactions.fish_id
      and (
        public.is_club_admin(f.club_id)
        or lower(trim(fish_reactions.user_name)) = lower(trim(coalesce(public.current_profile_name(f.club_id), '')))
      )
  )
);

-- Legacy tables (exist in kirevrwmmthqgceprbhl, optional elsewhere).
do $$
begin
  if to_regclass('public.likes') is not null then
    execute $sql$
      create policy likes_select
      on public.likes
      for select
      to authenticated
      using (
        public.is_superadmin()
        or public.is_club_member(club_id)
      )
    $sql$;

    execute $sql$
      create policy likes_insert
      on public.likes
      for insert
      to authenticated
      with check (
        public.is_superadmin()
        or (
          public.is_club_member(club_id)
          and lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
        )
      )
    $sql$;

    execute $sql$
      create policy likes_update
      on public.likes
      for update
      to authenticated
      using (
        public.is_superadmin()
        or public.is_club_admin(club_id)
        or lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
      )
      with check (
        public.is_superadmin()
        or public.is_club_admin(club_id)
        or (
          public.is_club_member(club_id)
          and lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
        )
      )
    $sql$;

    execute $sql$
      create policy likes_delete
      on public.likes
      for delete
      to authenticated
      using (
        public.is_superadmin()
        or public.is_club_admin(club_id)
        or lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
      )
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.comments') is not null then
    execute $sql$
      create policy comments_select
      on public.comments
      for select
      to authenticated
      using (
        public.is_superadmin()
        or public.is_club_member(club_id)
      )
    $sql$;

    execute $sql$
      create policy comments_insert
      on public.comments
      for insert
      to authenticated
      with check (
        public.is_superadmin()
        or (
          public.is_club_member(club_id)
          and lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
        )
      )
    $sql$;

    execute $sql$
      create policy comments_update
      on public.comments
      for update
      to authenticated
      using (
        public.is_superadmin()
        or public.is_club_admin(club_id)
        or lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
      )
      with check (
        public.is_superadmin()
        or public.is_club_admin(club_id)
        or (
          public.is_club_member(club_id)
          and lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
        )
      )
    $sql$;

    execute $sql$
      create policy comments_delete
      on public.comments
      for delete
      to authenticated
      using (
        public.is_superadmin()
        or public.is_club_admin(club_id)
        or lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
      )
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.push_errors') is not null then
    execute $sql$
      create policy push_errors_select
      on public.push_errors
      for select
      to authenticated
      using (
        public.is_superadmin()
        or public.is_club_admin(club_id)
      )
    $sql$;

    execute $sql$
      create policy push_errors_insert
      on public.push_errors
      for insert
      to authenticated
      with check (
        public.is_superadmin()
        or public.is_club_member(club_id)
      )
    $sql$;

    execute $sql$
      create policy push_errors_update
      on public.push_errors
      for update
      to authenticated
      using (
        public.is_superadmin()
        or public.is_club_admin(club_id)
      )
      with check (
        public.is_superadmin()
        or public.is_club_admin(club_id)
      )
    $sql$;

    execute $sql$
      create policy push_errors_delete
      on public.push_errors
      for delete
      to authenticated
      using (
        public.is_superadmin()
        or public.is_club_admin(club_id)
      )
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.batt_log') is not null then
    execute $sql$
      create policy batt_log_select
      on public.batt_log
      for select
      to authenticated
      using (public.is_any_admin())
    $sql$;

    execute $sql$
      create policy batt_log_write_superadmin
      on public.batt_log
      for all
      to authenticated
      using (public.is_superadmin())
      with check (public.is_superadmin())
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.gps_log') is not null then
    execute $sql$
      create policy gps_log_select
      on public.gps_log
      for select
      to authenticated
      using (public.is_any_admin())
    $sql$;

    execute $sql$
      create policy gps_log_write_superadmin
      on public.gps_log
      for all
      to authenticated
      using (public.is_superadmin())
      with check (public.is_superadmin())
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.temperature_log') is not null then
    execute $sql$
      create policy temperature_log_select
      on public.temperature_log
      for select
      to authenticated
      using (public.is_any_admin())
    $sql$;

    execute $sql$
      create policy temperature_log_write_superadmin
      on public.temperature_log
      for all
      to authenticated
      using (public.is_superadmin())
      with check (public.is_superadmin())
    $sql$;
  end if;
end
$$;

commit;
