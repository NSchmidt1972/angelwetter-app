begin;

create table if not exists public.club_features (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_features_unique unique (club_id, feature_key),
  constraint club_features_feature_key_check check (
    feature_key in (
      'forecast',
      'map',
      'push',
      'leaderboard',
      'analysis',
      'admin_tools',
      'catch_logging',
      'weather'
    )
  )
);

create index if not exists club_features_club_idx on public.club_features (club_id);

create table if not exists public.club_role_features (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  role text not null,
  feature_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_role_features_unique unique (club_id, role, feature_key),
  constraint club_role_features_role_check check (
    role in ('gast', 'mitglied', 'tester', 'vorstand', 'admin')
  ),
  constraint club_role_features_feature_key_check check (
    feature_key in (
      'forecast',
      'map',
      'push',
      'leaderboard',
      'analysis',
      'admin_tools',
      'catch_logging',
      'weather'
    )
  )
);

create index if not exists club_role_features_club_idx on public.club_role_features (club_id);

drop trigger if exists t_set_updated_at_club_features on public.club_features;
create trigger t_set_updated_at_club_features
before update on public.club_features
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_club_role_features on public.club_role_features;
create trigger t_set_updated_at_club_role_features
before update on public.club_role_features
for each row execute function public.set_updated_at();

create or replace function public.role_level(p_role text)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(p_role, '')))
    when 'gast' then 10
    when 'mitglied' then 20
    when 'tester' then 30
    when 'vorstand' then 40
    when 'admin' then 50
    else 0
  end;
$$;

create or replace function public.is_role_at_least(p_current_role text, p_required_role text)
returns boolean
language sql
immutable
as $$
  select public.role_level(p_current_role) >= public.role_level(p_required_role);
$$;

create or replace function public.current_member_role(p_club_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(
    (
      select m.role::text
      from public.memberships m
      where m.user_id = auth.uid()
        and m.club_id = p_club_id
        and m.is_active = true
      limit 1
    ),
    (
      select p.role::text
      from public.profiles p
      where p.id = auth.uid()
        and p.club_id = p_club_id
      limit 1
    ),
    'gast'
  )));
$$;

create or replace function public.is_feature_enabled(p_club_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_features cf
    where cf.club_id = p_club_id
      and cf.feature_key = lower(trim(coalesce(p_feature_key, '')))
      and cf.enabled = true
  );
$$;

create or replace function public.is_role_feature_enabled(
  p_club_id uuid,
  p_role text,
  p_feature_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_feature_enabled(p_club_id, p_feature_key)
    and coalesce(
      (
        select crf.enabled
        from public.club_role_features crf
        where crf.club_id = p_club_id
          and crf.role = lower(trim(coalesce(p_role, '')))
          and crf.feature_key = lower(trim(coalesce(p_feature_key, '')))
        limit 1
      ),
      true
    );
$$;

create or replace function public.create_club_with_defaults(
  p_slug text,
  p_name text,
  p_host text default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'forbidden';
  end if;

  insert into public.clubs (slug, name, host, is_active)
  values (
    lower(trim(p_slug)),
    trim(p_name),
    nullif(trim(coalesce(p_host, '')), ''),
    coalesce(p_is_active, true)
  )
  returning id into v_club_id;

  insert into public.club_features (club_id, feature_key, enabled)
  values
    (v_club_id, 'weather', true),
    (v_club_id, 'catch_logging', true),
    (v_club_id, 'forecast', true),
    (v_club_id, 'map', true),
    (v_club_id, 'leaderboard', true),
    (v_club_id, 'analysis', true),
    (v_club_id, 'push', false),
    (v_club_id, 'admin_tools', true)
  on conflict (club_id, feature_key) do update
  set enabled = excluded.enabled;

  return v_club_id;
end;
$$;

grant execute on function public.role_level(text) to authenticated, service_role;
grant execute on function public.is_role_at_least(text, text) to authenticated, service_role;
grant execute on function public.current_member_role(uuid) to authenticated, service_role;
grant execute on function public.is_feature_enabled(uuid, text) to authenticated, service_role;
grant execute on function public.is_role_feature_enabled(uuid, text, text) to authenticated, service_role;
grant execute on function public.create_club_with_defaults(text, text, text, boolean) to authenticated, service_role;

grant select, insert, update, delete on table public.club_features to authenticated, service_role;
grant select, insert, update, delete on table public.club_role_features to authenticated, service_role;

alter table public.club_features enable row level security;
alter table public.club_role_features enable row level security;

drop policy if exists club_features_select on public.club_features;
create policy club_features_select
on public.club_features
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

drop policy if exists club_features_manage on public.club_features;
create policy club_features_manage
on public.club_features
for all
to authenticated
using (
  public.is_superadmin()
  or public.is_role_at_least(public.current_member_role(club_id), 'vorstand')
)
with check (
  public.is_superadmin()
  or public.is_role_at_least(public.current_member_role(club_id), 'vorstand')
);

drop policy if exists club_role_features_select on public.club_role_features;
create policy club_role_features_select
on public.club_role_features
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

drop policy if exists club_role_features_manage on public.club_role_features;
create policy club_role_features_manage
on public.club_role_features
for all
to authenticated
using (
  public.is_superadmin()
  or public.is_role_at_least(public.current_member_role(club_id), 'vorstand')
)
with check (
  public.is_superadmin()
  or public.is_role_at_least(public.current_member_role(club_id), 'vorstand')
);

with feature_defaults(feature_key, enabled) as (
  values
    ('weather'::text, true),
    ('catch_logging'::text, true),
    ('forecast'::text, true),
    ('map'::text, true),
    ('leaderboard'::text, true),
    ('analysis'::text, true),
    ('push'::text, false),
    ('admin_tools'::text, true)
)
insert into public.club_features (club_id, feature_key, enabled)
select c.id, fd.feature_key, fd.enabled
from public.clubs c
cross join feature_defaults fd
on conflict (club_id, feature_key) do nothing;

drop policy if exists fishes_insert on public.fishes;
create policy fishes_insert
on public.fishes
for insert
to authenticated
with check (
  public.is_superadmin()
  or (
    public.is_club_member(club_id)
    and public.is_role_at_least(public.current_member_role(club_id), 'mitglied')
  )
);

drop policy if exists crayfish_insert on public.crayfish_catches;
create policy crayfish_insert
on public.crayfish_catches
for insert
to authenticated
with check (
  public.is_superadmin()
  or (
    public.is_club_member(club_id)
    and public.is_role_at_least(public.current_member_role(club_id), 'mitglied')
  )
);

create or replace function public.admin_page_view_years(
  p_club_id uuid,
  p_excluded_angler text default null
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

create or replace function public.admin_page_view_monthly_counts(
  p_club_id uuid,
  p_year integer default null,
  p_excluded_angler text default null
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

commit;
