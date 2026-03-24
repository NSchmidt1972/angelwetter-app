-- Final cleanup for legacy deterministic club IDs in non-key text fields.
-- Covers logo URLs and historical analytics/page path strings.

begin;

create temporary table _legacy_club_id_text_map (
  old_id uuid primary key,
  new_id uuid not null
) on commit drop;

-- Build mapping from known legacy IDs to current club UUIDs.
insert into _legacy_club_id_text_map (old_id, new_id)
select '00000000-0000-0000-0000-000000000001'::uuid, c.id
from public.clubs c
where c.slug = 'asv-rotauge'
limit 1;

insert into _legacy_club_id_text_map (old_id, new_id)
select '00000000-0000-0000-0000-000000000002'::uuid, c.id
from public.clubs c
where c.slug = 'asv-gelbauge'
limit 1
on conflict (old_id) do update set new_id = excluded.new_id;

-- Ensure at least the rotauge mapping exists.
do $$
begin
  if not exists (
    select 1
    from _legacy_club_id_text_map
    where old_id = '00000000-0000-0000-0000-000000000001'::uuid
  ) then
    raise exception 'Cannot clean legacy ID strings: slug asv-rotauge not found in public.clubs.';
  end if;
end
$$;

-- Replace legacy ID strings in known text fields.
do $$
declare
  v_map record;
begin
  for v_map in
    select old_id::text as old_id, new_id::text as new_id
    from _legacy_club_id_text_map
  loop
    update public.clubs c
       set logo_url = replace(c.logo_url, v_map.old_id, v_map.new_id)
     where c.logo_url is not null
       and c.logo_url like '%' || v_map.old_id || '%';

    update public.analytics_events a
       set path = case when a.path is null then null else replace(a.path, v_map.old_id, v_map.new_id) end,
           full_path = case when a.full_path is null then null else replace(a.full_path, v_map.old_id, v_map.new_id) end
     where coalesce(a.path, '') like '%' || v_map.old_id || '%'
        or coalesce(a.full_path, '') like '%' || v_map.old_id || '%';

    update public.page_views p
       set path = case when p.path is null then null else replace(p.path, v_map.old_id, v_map.new_id) end,
           full_path = case when p.full_path is null then null else replace(p.full_path, v_map.old_id, v_map.new_id) end
     where coalesce(p.path, '') like '%' || v_map.old_id || '%'
        or coalesce(p.full_path, '') like '%' || v_map.old_id || '%';
  end loop;
end
$$;

-- Prevent reintroduction via clubs.logo_url.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clubs'::regclass
      and conname = 'clubs_logo_url_no_legacy_zero_prefix'
  ) then
    alter table public.clubs
      add constraint clubs_logo_url_no_legacy_zero_prefix
      check (
        logo_url is null
        or logo_url not like '%/club-logos/00000000-0000-0000-0000-0000000000%/%'
      );
  end if;
end
$$;

-- Hard-stop if legacy IDs are still present in these fields.
do $$
begin
  if exists (
    select 1
    from public.clubs c
    where coalesce(c.logo_url, '') like '%00000000-0000-0000-0000-0000000000%'
  ) then
    raise exception 'clubs.logo_url still contains legacy 000... club IDs after cleanup.';
  end if;

  if exists (
    select 1
    from public.analytics_events a
    where coalesce(a.path, '') like '%00000000-0000-0000-0000-0000000000%'
       or coalesce(a.full_path, '') like '%00000000-0000-0000-0000-0000000000%'
  ) then
    raise exception 'analytics_events path/full_path still contain legacy 000... club IDs after cleanup.';
  end if;

  if exists (
    select 1
    from public.page_views p
    where coalesce(p.path, '') like '%00000000-0000-0000-0000-0000000000%'
       or coalesce(p.full_path, '') like '%00000000-0000-0000-0000-0000000000%'
  ) then
    raise exception 'page_views path/full_path still contain legacy 000... club IDs after cleanup.';
  end if;
end
$$;

commit;
