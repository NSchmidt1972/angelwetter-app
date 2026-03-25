begin;

create table if not exists public.waterbodies (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  slug text,
  lat double precision not null,
  lon double precision not null,
  radius_m integer not null default 300,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  description text,
  water_type text,
  weather_lat double precision,
  weather_lon double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists waterbodies_club_active_sort_order_idx
  on public.waterbodies (club_id, is_active, sort_order);

create unique index if not exists waterbodies_club_slug_unique_idx
  on public.waterbodies (club_id, lower(slug))
  where slug is not null;

drop trigger if exists t_set_updated_at_waterbodies on public.waterbodies;
create trigger t_set_updated_at_waterbodies
before update on public.waterbodies
for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.waterbodies to authenticated, service_role;

alter table public.waterbodies enable row level security;

drop policy if exists waterbodies_select on public.waterbodies;
create policy waterbodies_select
on public.waterbodies
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

drop policy if exists waterbodies_manage on public.waterbodies;
create policy waterbodies_manage
on public.waterbodies
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

create or replace function public.seed_default_waterbody_for_club(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weather_lat double precision;
  v_weather_lon double precision;
begin
  if p_club_id is null then
    return;
  end if;

  select c.weather_lat, c.weather_lon
  into v_weather_lat, v_weather_lon
  from public.clubs c
  where c.id = p_club_id;

  insert into public.waterbodies (
    club_id,
    name,
    slug,
    lat,
    lon,
    radius_m,
    is_active,
    sort_order,
    description,
    water_type,
    weather_lat,
    weather_lon
  )
  values (
    p_club_id,
    'Vereinsgewässer',
    'vereinsgewaesser',
    coalesce(v_weather_lat, 51.3135),
    coalesce(v_weather_lon, 6.256),
    300,
    true,
    0,
    'Automatisch angelegtes Standard-Gewässer',
    null,
    v_weather_lat,
    v_weather_lon
  )
  on conflict (club_id, lower(slug)) where slug is not null
  do nothing;
end;
$$;

create or replace function public.seed_default_waterbody_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_waterbody_for_club(new.id);
  return new;
end;
$$;

drop trigger if exists t_seed_default_waterbody_on_insert on public.clubs;
create trigger t_seed_default_waterbody_on_insert
after insert on public.clubs
for each row execute function public.seed_default_waterbody_on_insert();

select public.seed_default_waterbody_for_club(c.id)
from public.clubs c;

alter table public.fishes
  add column if not exists waterbody_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fishes'::regclass
      and conname = 'fishes_waterbody_id_fkey'
  ) then
    alter table public.fishes
      add constraint fishes_waterbody_id_fkey
      foreign key (waterbody_id)
      references public.waterbodies(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists fishes_club_waterbody_timestamp_idx
  on public.fishes (club_id, waterbody_id, timestamp desc);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'club_fish_rules'
      and column_name = 'waterbody_id'
  ) then
    update public.club_fish_rules r
    set waterbody_id = null
    where r.waterbody_id is not null
      and not exists (
        select 1
        from public.waterbodies w
        where w.id = r.waterbody_id
          and w.club_id = r.club_id
      );

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.club_fish_rules'::regclass
        and conname = 'club_fish_rules_waterbody_id_fkey'
    ) then
      alter table public.club_fish_rules
        add constraint club_fish_rules_waterbody_id_fkey
        foreign key (waterbody_id)
        references public.waterbodies(id)
        on delete cascade;
    end if;
  end if;
end;
$$;

create or replace function public.ensure_waterbody_matches_club()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_waterbody_club_id uuid;
begin
  if new.waterbody_id is null then
    return new;
  end if;

  select w.club_id
  into v_waterbody_club_id
  from public.waterbodies w
  where w.id = new.waterbody_id;

  if v_waterbody_club_id is null then
    raise exception 'Waterbody % does not exist.', new.waterbody_id;
  end if;

  if v_waterbody_club_id <> new.club_id then
    raise exception 'Waterbody % does not belong to club %.', new.waterbody_id, new.club_id;
  end if;

  return new;
end;
$$;

drop trigger if exists t_ensure_waterbody_matches_club_fishes on public.fishes;
create trigger t_ensure_waterbody_matches_club_fishes
before insert or update of club_id, waterbody_id on public.fishes
for each row execute function public.ensure_waterbody_matches_club();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'club_fish_rules'
      and column_name = 'waterbody_id'
  ) then
    drop trigger if exists t_ensure_waterbody_matches_club_rules on public.club_fish_rules;
    create trigger t_ensure_waterbody_matches_club_rules
    before insert or update of club_id, waterbody_id on public.club_fish_rules
    for each row execute function public.ensure_waterbody_matches_club();
  end if;
end;
$$;

with default_waterbodies as (
  select
    w.id,
    w.club_id,
    w.lat as water_lat,
    w.lon as water_lon,
    greatest(w.radius_m, 50) as radius_m,
    c.weather_lat as club_weather_lat,
    c.weather_lon as club_weather_lon
  from public.waterbodies w
  join public.clubs c on c.id = w.club_id
  where lower(coalesce(w.slug, '')) = 'vereinsgewaesser'
)
update public.fishes f
set waterbody_id = d.id
from default_waterbodies d
where f.club_id = d.club_id
  and f.waterbody_id is null
  and (
    lower(trim(coalesce(f.location_name, ''))) in (
      'lobberich',
      'ferkensbruch',
      'vereinsgewässer',
      'vereinsgewasser',
      'vereinsgewaesser',
      'vereinssee'
    )
    or (
      f.lat is not null
      and f.lon is not null
      and d.club_weather_lat is not null
      and d.club_weather_lon is not null
      and (
        6371000 * 2 * asin(
          sqrt(
            power(sin(radians((f.lat - d.water_lat) / 2)), 2)
            + cos(radians(d.water_lat))
            * cos(radians(f.lat))
            * power(sin(radians((f.lon - d.water_lon) / 2)), 2)
          )
        )
      ) <= d.radius_m
    )
  );

commit;
