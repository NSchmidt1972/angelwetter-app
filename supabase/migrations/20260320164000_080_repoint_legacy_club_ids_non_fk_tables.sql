-- Repoint legacy deterministic club IDs in tables that were not covered by FK-based rotation.
-- Affected tables in production dump: profiles, whitelist_emails, crayfish_catches.

begin;

-- 1) Build deterministic legacy mapping by slug.
do $$
declare
  v_rotauge_id uuid;
  v_gelbauge_id uuid;
  v_unmapped_count integer;
begin
  select c.id into v_rotauge_id
  from public.clubs c
  where c.slug = 'asv-rotauge'
  limit 1;

  if v_rotauge_id is null then
    raise exception 'Cannot remap legacy club IDs: slug asv-rotauge not found in public.clubs.';
  end if;

  create temporary table _legacy_club_id_manual_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  insert into _legacy_club_id_manual_map (old_id, new_id)
  values ('00000000-0000-0000-0000-000000000001'::uuid, v_rotauge_id)
  on conflict (old_id) do update set new_id = excluded.new_id;

  select c.id into v_gelbauge_id
  from public.clubs c
  where c.slug = 'asv-gelbauge'
  limit 1;

  if v_gelbauge_id is not null then
    insert into _legacy_club_id_manual_map (old_id, new_id)
    values ('00000000-0000-0000-0000-000000000002'::uuid, v_gelbauge_id)
    on conflict (old_id) do update set new_id = excluded.new_id;
  end if;

  select count(*) into v_unmapped_count
  from (
    select p.club_id
    from public.profiles p
    where p.club_id is not null
      and p.club_id::text like '00000000-0000-0000-0000-0000000000%'
    union all
    select w.club_id
    from public.whitelist_emails w
    where w.club_id is not null
      and w.club_id::text like '00000000-0000-0000-0000-0000000000%'
    union all
    select c.club_id
    from public.crayfish_catches c
    where c.club_id is not null
      and c.club_id::text like '00000000-0000-0000-0000-0000000000%'
  ) legacy_values
  where not exists (
    select 1
    from _legacy_club_id_manual_map m
    where m.old_id = legacy_values.club_id
  );

  if v_unmapped_count > 0 then
    raise exception 'Found % legacy club_id value(s) without mapping. Add mapping before migration.', v_unmapped_count;
  end if;
end
$$;

-- 2) whitelist_emails: temporarily drop unique, remap, dedupe, recreate unique.
alter table public.whitelist_emails
  drop constraint if exists whitelist_emails_email_club_unique;

update public.whitelist_emails w
set club_id = m.new_id
from _legacy_club_id_manual_map m
where w.club_id = m.old_id;

with ranked as (
  select
    w.id,
    row_number() over (
      partition by w.email, w.club_id
      order by w.created_at asc, w.id asc
    ) as rn
  from public.whitelist_emails w
)
delete from public.whitelist_emails w
using ranked r
where w.id = r.id
  and r.rn > 1;

-- 3) profiles + crayfish_catches remap.
update public.profiles p
set club_id = m.new_id
from _legacy_club_id_manual_map m
where p.club_id = m.old_id;

update public.crayfish_catches c
set club_id = m.new_id
from _legacy_club_id_manual_map m
where c.club_id = m.old_id;

-- 4) Guard rails: no NULL / no legacy IDs in the migrated tables.
do $$
begin
  if exists (select 1 from public.profiles where club_id is null) then
    raise exception 'profiles.club_id contains NULL after remap.';
  end if;
  if exists (select 1 from public.whitelist_emails where club_id is null) then
    raise exception 'whitelist_emails.club_id contains NULL after remap.';
  end if;
  if exists (select 1 from public.crayfish_catches where club_id is null) then
    raise exception 'crayfish_catches.club_id contains NULL after remap.';
  end if;

  if exists (select 1 from public.profiles where club_id::text like '00000000-0000-0000-0000-0000000000%') then
    raise exception 'profiles still contains legacy 000... club_id values.';
  end if;
  if exists (select 1 from public.whitelist_emails where club_id::text like '00000000-0000-0000-0000-0000000000%') then
    raise exception 'whitelist_emails still contains legacy 000... club_id values.';
  end if;
  if exists (select 1 from public.crayfish_catches where club_id::text like '00000000-0000-0000-0000-0000000000%') then
    raise exception 'crayfish_catches still contains legacy 000... club_id values.';
  end if;
end
$$;

-- 5) Structural hardening to prevent regressions.
alter table public.profiles
  alter column club_id drop default,
  alter column club_id set not null;

alter table public.whitelist_emails
  alter column club_id set not null;

alter table public.crayfish_catches
  alter column club_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.whitelist_emails'::regclass
      and conname = 'whitelist_emails_email_club_unique'
  ) then
    alter table public.whitelist_emails
      add constraint whitelist_emails_email_club_unique unique (email, club_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_club_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_club_id_fkey
      foreign key (club_id) references public.clubs(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.whitelist_emails'::regclass
      and conname = 'whitelist_emails_club_id_fkey'
  ) then
    alter table public.whitelist_emails
      add constraint whitelist_emails_club_id_fkey
      foreign key (club_id) references public.clubs(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crayfish_catches'::regclass
      and conname = 'crayfish_catches_club_id_fkey'
  ) then
    alter table public.crayfish_catches
      add constraint crayfish_catches_club_id_fkey
      foreign key (club_id) references public.clubs(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_club_id_not_legacy_zero_prefix'
  ) then
    alter table public.profiles
      add constraint profiles_club_id_not_legacy_zero_prefix
      check (club_id::text not like '00000000-0000-0000-0000-0000000000%');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.whitelist_emails'::regclass
      and conname = 'whitelist_emails_club_id_not_legacy_zero_prefix'
  ) then
    alter table public.whitelist_emails
      add constraint whitelist_emails_club_id_not_legacy_zero_prefix
      check (club_id::text not like '00000000-0000-0000-0000-0000000000%');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crayfish_catches'::regclass
      and conname = 'crayfish_catches_club_id_not_legacy_zero_prefix'
  ) then
    alter table public.crayfish_catches
      add constraint crayfish_catches_club_id_not_legacy_zero_prefix
      check (club_id::text not like '00000000-0000-0000-0000-0000000000%');
  end if;
end
$$;

commit;
