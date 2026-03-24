begin;

do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(c.oid)
    into v_def
  from pg_constraint c
  where c.conrelid = 'public.weather_cache'::regclass
    and c.conname = 'weather_cache_pkey'
    and c.contype = 'p';

  if v_def is null then
    alter table public.weather_cache
      add constraint weather_cache_pkey primary key (club_id, id);
  elsif lower(v_def) = 'primary key (id)' then
    alter table public.weather_cache
      drop constraint weather_cache_pkey;
    alter table public.weather_cache
      add constraint weather_cache_pkey primary key (club_id, id);
  end if;
end
$$;

alter table public.weather_cache
  alter column club_id set not null,
  alter column id set not null;

insert into public.weather_cache (club_id, id, data, updated_at)
select c.id, 'latest', '{}'::jsonb, timezone('utc', now())
from public.clubs c
on conflict do nothing;

commit;
