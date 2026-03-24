begin;

-- Ensure each club has a weather_cache "latest" row (data may still be empty initially).
insert into public.weather_cache (club_id, id, data, updated_at)
select c.id, 'latest', '{}'::jsonb, timezone('utc', now())
from public.clubs c
on conflict do nothing;

create or replace function public.ensure_weather_cache_row_for_new_club()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.weather_cache (club_id, id, data, updated_at)
  values (new.id, 'latest', '{}'::jsonb, timezone('utc', now()))
  on conflict (club_id, id) do nothing;
  return new;
end;
$$;

drop trigger if exists t_clubs_seed_weather_cache on public.clubs;
create trigger t_clubs_seed_weather_cache
after insert on public.clubs
for each row execute function public.ensure_weather_cache_row_for_new_club();

commit;
