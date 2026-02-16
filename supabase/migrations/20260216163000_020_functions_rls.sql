-- Multi-tenant baseline: helper functions + RLS policies

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.superadmins sa
    where sa.user_id = auth.uid()
  );
$$;

create or replace function public.is_club_member(p_club_id uuid)
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
        and m.club_id = p_club_id
        and m.is_active = true
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.club_id = p_club_id
    );
$$;

create or replace function public.is_club_admin(p_club_id uuid)
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
        and m.club_id = p_club_id
        and m.is_active = true
        and m.role in ('admin', 'vorstand')
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.club_id = p_club_id
        and p.role in ('admin', 'vorstand')
    );
$$;

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
      and w.email = lower(trim(coalesce(p_email, '')))
  );
$$;

create or replace function public.set_fish_reaction_club_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  select f.club_id
  into v_club_id
  from public.fishes f
  where f.id = new.fish_id;

  if v_club_id is null then
    raise exception 'Fish % does not exist', new.fish_id;
  end if;

  new.club_id := v_club_id;
  return new;
end;
$$;

drop trigger if exists t_set_fish_reaction_club_id on public.fish_reactions;
create trigger t_set_fish_reaction_club_id
before insert or update on public.fish_reactions
for each row execute function public.set_fish_reaction_club_id();

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Required for public club/slug lookup and signup whitelist RPC
grant select on table public.clubs to anon, authenticated;

grant execute on function public.is_superadmin() to authenticated, service_role;
grant execute on function public.is_club_member(uuid) to authenticated, service_role;
grant execute on function public.is_club_admin(uuid) to authenticated, service_role;
grant execute on function public.current_profile_name(uuid) to authenticated, service_role;
grant execute on function public.is_profile_owner_name(uuid, text) to authenticated, service_role;
grant execute on function public.is_email_whitelisted(text, uuid) to anon, authenticated, service_role;

alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.superadmins enable row level security;
alter table public.whitelist_emails enable row level security;
alter table public.fishes enable row level security;
alter table public.crayfish_catches enable row level security;
alter table public.user_activity enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.page_views enable row level security;
alter table public.fish_reactions enable row level security;
alter table public.weather_cache enable row level security;
alter table public.weather_log enable row level security;
alter table public.weather_summary enable row level security;

-- clubs

drop policy if exists clubs_public_select on public.clubs;
create policy clubs_public_select
on public.clubs
for select
to anon, authenticated
using (true);

drop policy if exists clubs_superadmin_manage on public.clubs;
create policy clubs_superadmin_manage
on public.clubs
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

-- profiles

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_club_admin(club_id)
  or public.is_superadmin()
);

drop policy if exists profiles_insert on public.profiles;
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

drop policy if exists profiles_update on public.profiles;
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

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete
on public.profiles
for delete
to authenticated
using (
  public.is_club_admin(club_id)
  or public.is_superadmin()
);

-- memberships

drop policy if exists memberships_select on public.memberships;
create policy memberships_select
on public.memberships
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_club_admin(club_id)
  or public.is_superadmin()
);

drop policy if exists memberships_insert on public.memberships;
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
    and role in ('mitglied', 'gast', 'tester')
    and public.is_email_whitelisted(coalesce(auth.jwt() ->> 'email', ''), club_id)
  )
);

drop policy if exists memberships_update on public.memberships;
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

drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete
on public.memberships
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

-- superadmins

drop policy if exists superadmins_select on public.superadmins;
create policy superadmins_select
on public.superadmins
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_superadmin()
);

drop policy if exists superadmins_manage on public.superadmins;
create policy superadmins_manage
on public.superadmins
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

-- whitelist_emails

drop policy if exists whitelist_select on public.whitelist_emails;
create policy whitelist_select
on public.whitelist_emails
for select
to authenticated
using (
  public.is_club_admin(club_id)
  or public.is_superadmin()
);

drop policy if exists whitelist_insert on public.whitelist_emails;
create policy whitelist_insert
on public.whitelist_emails
for insert
to authenticated
with check (
  public.is_club_admin(club_id)
  or public.is_superadmin()
);

drop policy if exists whitelist_update on public.whitelist_emails;
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

drop policy if exists whitelist_delete on public.whitelist_emails;
create policy whitelist_delete
on public.whitelist_emails
for delete
to authenticated
using (
  public.is_club_admin(club_id)
  or public.is_superadmin()
);

-- fishes

drop policy if exists fishes_select on public.fishes;
create policy fishes_select
on public.fishes
for select
to authenticated
using (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

drop policy if exists fishes_insert on public.fishes;
create policy fishes_insert
on public.fishes
for insert
to authenticated
with check (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

drop policy if exists fishes_update on public.fishes;
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

drop policy if exists fishes_delete on public.fishes;
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

drop policy if exists crayfish_select on public.crayfish_catches;
create policy crayfish_select
on public.crayfish_catches
for select
to authenticated
using (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

drop policy if exists crayfish_insert on public.crayfish_catches;
create policy crayfish_insert
on public.crayfish_catches
for insert
to authenticated
with check (
  public.is_club_member(club_id)
  or public.is_superadmin()
);

drop policy if exists crayfish_update on public.crayfish_catches;
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

drop policy if exists crayfish_delete on public.crayfish_catches;
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

drop policy if exists user_activity_select on public.user_activity;
create policy user_activity_select
on public.user_activity
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or auth.uid() = user_id
);

drop policy if exists user_activity_insert on public.user_activity;
create policy user_activity_insert
on public.user_activity
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or (auth.uid() = user_id and public.is_club_member(club_id))
);

drop policy if exists user_activity_update on public.user_activity;
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

drop policy if exists user_activity_delete on public.user_activity;
create policy user_activity_delete
on public.user_activity
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

-- push_subscriptions

drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select
on public.push_subscriptions
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or auth.uid() = user_id
);

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert
on public.push_subscriptions
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or (auth.uid() = user_id and public.is_club_member(club_id))
);

drop policy if exists push_subscriptions_update on public.push_subscriptions;
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

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
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

drop policy if exists page_views_select on public.page_views;
create policy page_views_select
on public.page_views
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

drop policy if exists page_views_insert on public.page_views;
create policy page_views_insert
on public.page_views
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

-- fish_reactions

drop policy if exists fish_reactions_select on public.fish_reactions;
create policy fish_reactions_select
on public.fish_reactions
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

drop policy if exists fish_reactions_insert on public.fish_reactions;
create policy fish_reactions_insert
on public.fish_reactions
for insert
to authenticated
with check (
  public.is_superadmin()
  or (
    public.is_club_member(club_id)
    and lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
  )
);

drop policy if exists fish_reactions_update on public.fish_reactions;
create policy fish_reactions_update
on public.fish_reactions
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
);

drop policy if exists fish_reactions_delete on public.fish_reactions;
create policy fish_reactions_delete
on public.fish_reactions
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or lower(trim(user_name)) = lower(trim(coalesce(public.current_profile_name(club_id), '')))
);

-- weather_cache

drop policy if exists weather_cache_select on public.weather_cache;
create policy weather_cache_select
on public.weather_cache
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

drop policy if exists weather_cache_insert on public.weather_cache;
create policy weather_cache_insert
on public.weather_cache
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

drop policy if exists weather_cache_update on public.weather_cache;
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

drop policy if exists weather_cache_delete on public.weather_cache;
create policy weather_cache_delete
on public.weather_cache
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

-- weather_log

drop policy if exists weather_log_select on public.weather_log;
create policy weather_log_select
on public.weather_log
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

drop policy if exists weather_log_insert on public.weather_log;
create policy weather_log_insert
on public.weather_log
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

drop policy if exists weather_log_update on public.weather_log;
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

drop policy if exists weather_log_delete on public.weather_log;
create policy weather_log_delete
on public.weather_log
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

-- weather_summary

drop policy if exists weather_summary_select on public.weather_summary;
create policy weather_summary_select
on public.weather_summary
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

drop policy if exists weather_summary_insert on public.weather_summary;
create policy weather_summary_insert
on public.weather_summary
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

drop policy if exists weather_summary_update on public.weather_summary;
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

drop policy if exists weather_summary_delete on public.weather_summary;
create policy weather_summary_delete
on public.weather_summary
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);
