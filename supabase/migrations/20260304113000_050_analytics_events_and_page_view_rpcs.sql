-- Analytics foundation + page-view aggregation RPCs

-- Compatibility helper functions (for projects where these helpers are missing)
create or replace function public.is_superadmin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result boolean := false;
begin
  if to_regclass('public.superadmins') is null then
    return false;
  end if;

  execute $q$
    select exists (
      select 1
      from public.superadmins sa
      where sa.user_id = auth.uid()
    )
  $q$ into result;

  return coalesce(result, false);
end;
$$;

create or replace function public.is_club_member(p_club_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result boolean := false;
begin
  if public.is_superadmin() then
    return true;
  end if;

  if to_regclass('public.memberships') is not null then
    execute $q$
      select exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.club_id = $1
          and coalesce(m.is_active, true) = true
      )
    $q$ into result using p_club_id;
    return coalesce(result, false);
  end if;

  if to_regclass('public.profiles') is not null then
    execute $q$
      select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.club_id = $1
      )
    $q$ into result using p_club_id;
    return coalesce(result, false);
  end if;

  return false;
end;
$$;

create or replace function public.is_club_admin(p_club_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result boolean := false;
begin
  if public.is_superadmin() then
    return true;
  end if;

  if to_regclass('public.memberships') is not null then
    execute $q$
      select exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.club_id = $1
          and coalesce(m.is_active, true) = true
          and m.role in ('admin', 'vorstand')
      )
    $q$ into result using p_club_id;
    return coalesce(result, false);
  end if;

  if to_regclass('public.profiles') is not null then
    execute $q$
      select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.club_id = $1
          and p.role in ('admin', 'vorstand')
      )
    $q$ into result using p_club_id;
    return coalesce(result, false);
  end if;

  return false;
end;
$$;

grant execute on function public.is_superadmin() to authenticated, service_role;
grant execute on function public.is_club_member(uuid) to authenticated, service_role;
grant execute on function public.is_club_admin(uuid) to authenticated, service_role;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  path text,
  full_path text,
  angler text,
  session_id text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analytics_events_club_occurred_idx
  on public.analytics_events (club_id, occurred_at desc);
create index if not exists analytics_events_club_event_occurred_idx
  on public.analytics_events (club_id, event_name, occurred_at desc);
create index if not exists analytics_events_club_path_occurred_idx
  on public.analytics_events (club_id, path, occurred_at desc);
create index if not exists analytics_events_occurred_brin_idx
  on public.analytics_events using brin (occurred_at);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_select on public.analytics_events;
create policy analytics_events_select
on public.analytics_events
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert
on public.analytics_events
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

drop policy if exists analytics_events_update on public.analytics_events;
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

drop policy if exists analytics_events_delete on public.analytics_events;
create policy analytics_events_delete
on public.analytics_events
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create or replace function public.admin_page_view_years(
  p_club_id uuid,
  p_excluded_angler text default 'nicol schmidt'
)
returns table(year integer)
language sql
stable
as $$
  select distinct extract(year from timezone('Europe/Berlin', pv.created_at))::int as year
  from public.page_views pv
  where pv.club_id = p_club_id
    and (
      p_excluded_angler is null
      or btrim(p_excluded_angler) = ''
      or coalesce(lower(btrim(pv.angler)), '') <> lower(btrim(p_excluded_angler))
    )
  order by year desc;
$$;

grant execute on function public.admin_page_view_years(uuid, text) to authenticated;

create or replace function public.admin_page_view_monthly_counts(
  p_club_id uuid,
  p_year integer default null,
  p_excluded_angler text default 'nicol schmidt'
)
returns table(
  year integer,
  month integer,
  total bigint
)
language sql
stable
as $$
  select
    extract(year from timezone('Europe/Berlin', pv.created_at))::int as year,
    extract(month from timezone('Europe/Berlin', pv.created_at))::int as month,
    count(*)::bigint as total
  from public.page_views pv
  where pv.club_id = p_club_id
    and (
      p_year is null
      or extract(year from timezone('Europe/Berlin', pv.created_at))::int = p_year
    )
    and (
      p_excluded_angler is null
      or btrim(p_excluded_angler) = ''
      or coalesce(lower(btrim(pv.angler)), '') <> lower(btrim(p_excluded_angler))
    )
  group by 1, 2
  order by 1 desc, 2 desc;
$$;

grant execute on function public.admin_page_view_monthly_counts(uuid, integer, text) to authenticated;
