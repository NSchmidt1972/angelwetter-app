begin;

-- Normalize existing email values to avoid accidental duplicates caused by casing/spaces.
update public.whitelist_emails
set email = lower(trim(coalesce(email::text, '')))
where email::text <> lower(trim(coalesce(email::text, '')));

-- Remove duplicate rows within the same club (keep oldest entry).
with ranked as (
  select
    id,
    row_number() over (
      partition by club_id, email
      order by created_at asc, id asc
    ) as rn
  from public.whitelist_emails
)
delete from public.whitelist_emails w
using ranked r
where w.id = r.id
  and r.rn > 1;

-- Drop legacy unique constraints that enforce global uniqueness on email only.
do $$
declare
  v_email_attnum smallint;
  v_constraint record;
begin
  select a.attnum
    into v_email_attnum
  from pg_attribute a
  where a.attrelid = 'public.whitelist_emails'::regclass
    and a.attname = 'email'
    and a.attisdropped = false;

  if v_email_attnum is null then
    return;
  end if;

  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.whitelist_emails'::regclass
      and c.contype = 'u'
      and c.conkey = array[v_email_attnum]
  loop
    execute format(
      'alter table public.whitelist_emails drop constraint if exists %I',
      v_constraint.conname
    );
  end loop;
end;
$$;

-- Drop standalone unique indexes on email only (if any legacy index exists).
do $$
declare
  v_email_attnum smallint;
  v_index record;
begin
  select a.attnum
    into v_email_attnum
  from pg_attribute a
  where a.attrelid = 'public.whitelist_emails'::regclass
    and a.attname = 'email'
    and a.attisdropped = false;

  if v_email_attnum is null then
    return;
  end if;

  for v_index in
    select idx.relname as index_name
    from pg_index i
    join pg_class idx on idx.oid = i.indexrelid
    join pg_class tbl on tbl.oid = i.indrelid
    join pg_namespace nsp on nsp.oid = tbl.relnamespace
    where nsp.nspname = 'public'
      and tbl.relname = 'whitelist_emails'
      and i.indisunique = true
      and i.indnatts = 1
      and i.indkey[0] = v_email_attnum
      and not exists (
        select 1
        from pg_constraint c
        where c.conindid = i.indexrelid
      )
  loop
    execute format('drop index if exists public.%I', v_index.index_name);
  end loop;
end;
$$;

-- Ensure unique email per club (email may exist in multiple clubs).
do $$
declare
  v_email_attnum smallint;
  v_club_attnum smallint;
begin
  select a.attnum
    into v_email_attnum
  from pg_attribute a
  where a.attrelid = 'public.whitelist_emails'::regclass
    and a.attname = 'email'
    and a.attisdropped = false;

  select a.attnum
    into v_club_attnum
  from pg_attribute a
  where a.attrelid = 'public.whitelist_emails'::regclass
    and a.attname = 'club_id'
    and a.attisdropped = false;

  if v_email_attnum is null or v_club_attnum is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.whitelist_emails'::regclass
      and c.contype = 'u'
      and c.conkey @> array[v_email_attnum, v_club_attnum]
      and c.conkey <@ array[v_email_attnum, v_club_attnum]
  ) then
    alter table public.whitelist_emails
      add constraint whitelist_emails_email_club_unique unique (email, club_id);
  end if;
end;
$$;

commit;
