-- Clubs: optional weather coordinates for tenant-specific lake defaults.
alter table public.clubs
  add column if not exists weather_lat double precision,
  add column if not exists weather_lon double precision;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clubs'::regclass
      and conname = 'clubs_weather_lat_range_check'
  ) then
    alter table public.clubs
      add constraint clubs_weather_lat_range_check
      check (weather_lat is null or (weather_lat >= -90 and weather_lat <= 90));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clubs'::regclass
      and conname = 'clubs_weather_lon_range_check'
  ) then
    alter table public.clubs
      add constraint clubs_weather_lon_range_check
      check (weather_lon is null or (weather_lon >= -180 and weather_lon <= 180));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clubs'::regclass
      and conname = 'clubs_weather_coords_pair_check'
  ) then
    alter table public.clubs
      add constraint clubs_weather_coords_pair_check
      check ((weather_lat is null) = (weather_lon is null));
  end if;
end
$$;
