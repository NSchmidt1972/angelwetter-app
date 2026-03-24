begin;

alter table if exists public.club_features
  drop constraint if exists club_features_feature_key_check;

alter table if exists public.club_features
  add constraint club_features_feature_key_check check (
    feature_key in (
      'forecast',
      'map',
      'push',
      'leaderboard',
      'analysis',
      'admin_tools',
      'catch_logging',
      'weather',
      'water_temperature'
    )
  );

alter table if exists public.club_role_features
  drop constraint if exists club_role_features_feature_key_check;

alter table if exists public.club_role_features
  add constraint club_role_features_feature_key_check check (
    feature_key in (
      'forecast',
      'map',
      'push',
      'leaderboard',
      'analysis',
      'admin_tools',
      'catch_logging',
      'weather',
      'water_temperature'
    )
  );

insert into public.club_features (club_id, feature_key, enabled)
select c.id, 'water_temperature', false
from public.clubs c
on conflict (club_id, feature_key) do nothing;

with role_defaults(role, enabled) as (
  values
    ('gast'::text, false),
    ('mitglied'::text, false),
    ('tester'::text, false),
    ('vorstand'::text, true),
    ('admin'::text, true)
)
insert into public.club_role_features (club_id, role, feature_key, enabled)
select c.id, rd.role, 'water_temperature', rd.enabled
from public.clubs c
cross join role_defaults rd
on conflict (club_id, role, feature_key) do nothing;

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
    (v_club_id, 'admin_tools', true),
    (v_club_id, 'water_temperature', false)
  on conflict (club_id, feature_key) do update
  set enabled = excluded.enabled;

  insert into public.club_role_features (club_id, role, feature_key, enabled)
  values
    (v_club_id, 'gast', 'water_temperature', false),
    (v_club_id, 'mitglied', 'water_temperature', false),
    (v_club_id, 'tester', 'water_temperature', false),
    (v_club_id, 'vorstand', 'water_temperature', true),
    (v_club_id, 'admin', 'water_temperature', true)
  on conflict (club_id, role, feature_key) do update
  set enabled = excluded.enabled;

  return v_club_id;
end;
$$;

create or replace function public.get_water_temperature_history(
  p_club_id uuid,
  p_days integer default 7,
  p_limit integer default 500
)
returns table(
  temperature_c double precision,
  measured_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 7), 30));
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 2000));
  v_role text;
  v_allowed boolean := false;
  v_since timestamptz;
begin
  if p_club_id is null then
    return;
  end if;

  if not public.is_superadmin() and not public.is_club_member(p_club_id) then
    return;
  end if;

  if public.is_superadmin() then
    v_allowed := true;
  else
    v_role := public.current_member_role(p_club_id);
    v_allowed := public.is_role_feature_enabled(p_club_id, v_role, 'water_temperature');
  end if;

  if not v_allowed then
    return;
  end if;

  if to_regclass('public.temperature_log') is null then
    return;
  end if;

  v_since := timezone('utc', now()) - make_interval(days => v_days);

  return query
    select t.temperature_c, coalesce(t.measured_at, t.created_at) as measured_at
    from public.temperature_log t
    where t.temperature_c is not null
      and coalesce(t.measured_at, t.created_at) >= v_since
    order by coalesce(t.measured_at, t.created_at) asc
    limit v_limit;
end;
$$;

grant execute on function public.get_water_temperature_history(uuid, integer, integer) to authenticated, service_role;

commit;
