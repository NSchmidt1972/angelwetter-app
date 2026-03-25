begin;

create table if not exists public.waterbody_sensors (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  waterbody_id uuid not null references public.waterbodies(id) on delete cascade,
  sensor_type text not null default 'temperature',
  device_id text not null,
  topic text,
  is_active boolean not null default true,
  valid_from timestamptz not null default timezone('utc', now()),
  valid_to timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint waterbody_sensors_sensor_type_check check (sensor_type in ('temperature'))
);

create index if not exists waterbody_sensors_club_sensor_active_idx
  on public.waterbody_sensors (club_id, sensor_type, is_active, valid_from desc);

create index if not exists waterbody_sensors_waterbody_sensor_active_idx
  on public.waterbody_sensors (waterbody_id, sensor_type, is_active, valid_from desc);

create unique index if not exists waterbody_sensors_one_active_per_waterbody_idx
  on public.waterbody_sensors (waterbody_id, sensor_type)
  where is_active = true and valid_to is null;

drop trigger if exists t_set_updated_at_waterbody_sensors on public.waterbody_sensors;
create trigger t_set_updated_at_waterbody_sensors
before update on public.waterbody_sensors
for each row execute function public.set_updated_at();

drop trigger if exists t_ensure_waterbody_matches_club_waterbody_sensors on public.waterbody_sensors;
create trigger t_ensure_waterbody_matches_club_waterbody_sensors
before insert or update of club_id, waterbody_id on public.waterbody_sensors
for each row execute function public.ensure_waterbody_matches_club();

grant select, insert, update, delete on table public.waterbody_sensors to authenticated, service_role;

alter table public.waterbody_sensors enable row level security;

drop policy if exists waterbody_sensors_select on public.waterbody_sensors;
create policy waterbody_sensors_select
on public.waterbody_sensors
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

drop policy if exists waterbody_sensors_manage on public.waterbody_sensors;
create policy waterbody_sensors_manage
on public.waterbody_sensors
for all
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

create or replace function public.get_water_temperature_history_for_waterbody(
  p_club_id uuid,
  p_waterbody_id uuid,
  p_days integer default 7,
  p_limit integer default 500,
  p_fallback_to_club boolean default true
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
  v_device_id text;
  v_topic text;
begin
  if p_club_id is null then
    return;
  end if;

  if p_waterbody_id is null then
    return query
      select h.temperature_c, h.measured_at
      from public.get_water_temperature_history(p_club_id, v_days, v_limit) h;
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

  if not exists (
    select 1
    from public.waterbodies w
    where w.id = p_waterbody_id
      and w.club_id = p_club_id
  ) then
    if coalesce(p_fallback_to_club, true) then
      return query
        select h.temperature_c, h.measured_at
        from public.get_water_temperature_history(p_club_id, v_days, v_limit) h;
    end if;
    return;
  end if;

  select ws.device_id, nullif(trim(ws.topic), '')
  into v_device_id, v_topic
  from public.waterbody_sensors ws
  where ws.club_id = p_club_id
    and ws.waterbody_id = p_waterbody_id
    and ws.sensor_type = 'temperature'
    and ws.is_active = true
    and (ws.valid_to is null or ws.valid_to > timezone('utc', now()))
  order by coalesce(ws.valid_from, ws.created_at) desc, ws.created_at desc
  limit 1;

  if nullif(trim(coalesce(v_device_id, '')), '') is null then
    if coalesce(p_fallback_to_club, true) then
      return query
        select h.temperature_c, h.measured_at
        from public.get_water_temperature_history(p_club_id, v_days, v_limit) h;
    end if;
    return;
  end if;

  v_since := timezone('utc', now()) - make_interval(days => v_days);

  return query
    select t.temperature_c, coalesce(t.measured_at, t.created_at) as measured_at
    from public.temperature_log t
    where t.temperature_c is not null
      and nullif(trim(coalesce(t.device_id, '')), '') = v_device_id
      and (v_topic is null or t.topic = v_topic)
      and coalesce(t.measured_at, t.created_at) >= v_since
    order by coalesce(t.measured_at, t.created_at) asc
    limit v_limit;

  if found then
    return;
  end if;

  if coalesce(p_fallback_to_club, true) then
    return query
      select h.temperature_c, h.measured_at
      from public.get_water_temperature_history(p_club_id, v_days, v_limit) h;
  end if;
end;
$$;

grant execute on function public.get_water_temperature_history_for_waterbody(uuid, uuid, integer, integer, boolean) to authenticated, service_role;

commit;
