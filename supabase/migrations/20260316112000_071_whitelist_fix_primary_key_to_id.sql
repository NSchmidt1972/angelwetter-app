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

-- Repair id handling for either uuid- or integer-based schemas.
do $$
declare
  v_id_attnum smallint;
  v_id_type text;
  v_id_seq text;
  v_null_count bigint;
begin
  select a.attnum, t.typname
    into v_id_attnum, v_id_type
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.whitelist_emails'::regclass
    and a.attname = 'id'
    and a.attisdropped = false;

  if v_id_attnum is null then
    return;
  end if;

  if v_id_type = 'uuid' then
    execute 'update public.whitelist_emails set id = gen_random_uuid() where id is null';
    execute 'alter table public.whitelist_emails alter column id set default gen_random_uuid()';
    execute 'alter table public.whitelist_emails alter column id set not null';
    return;
  end if;

  if v_id_type in ('int2', 'int4', 'int8') then
    select pg_get_serial_sequence('public.whitelist_emails', 'id')
      into v_id_seq;

    execute 'select count(*) from public.whitelist_emails where id is null'
      into v_null_count;

    if v_null_count > 0 then
      if v_id_seq is not null then
        execute format(
          'select setval(%L, coalesce((select max(id) from public.whitelist_emails), 0) + 1, false)',
          v_id_seq
        );
        execute format(
          'update public.whitelist_emails set id = nextval(%L) where id is null',
          v_id_seq
        );
      else
        with max_id as (
          select coalesce(max(id), 0)::bigint as m
          from public.whitelist_emails
        ),
        numbered as (
          select
            ctid,
            row_number() over (order by created_at asc, email asc, club_id asc) as rn
          from public.whitelist_emails
          where id is null
        )
        update public.whitelist_emails w
        set id = (max_id.m + numbered.rn)
        from max_id, numbered
        where w.ctid = numbered.ctid;
      end if;
    end if;

    execute 'alter table public.whitelist_emails alter column id set not null';

    if v_id_seq is not null then
      execute format(
        'select setval(%L, coalesce((select max(id) from public.whitelist_emails), 0) + 1, false)',
        v_id_seq
      );
    end if;
  end if;
end;
$$;

-- If the current primary key is not on id, replace it with primary key (id).
do $$
declare
  v_id_attnum smallint;
  v_pk_name text;
  v_pk_on_id boolean;
begin
  select a.attnum
    into v_id_attnum
  from pg_attribute a
  where a.attrelid = 'public.whitelist_emails'::regclass
    and a.attname = 'id'
    and a.attisdropped = false;

  if v_id_attnum is null then
    return;
  end if;

  select c.conname,
         (c.conkey = array[v_id_attnum]) as pk_on_id
    into v_pk_name, v_pk_on_id
  from pg_constraint c
  where c.conrelid = 'public.whitelist_emails'::regclass
    and c.contype = 'p'
  limit 1;

  if v_pk_name is not null and coalesce(v_pk_on_id, false) = false then
    execute format(
      'alter table public.whitelist_emails drop constraint if exists %I',
      v_pk_name
    );
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.whitelist_emails'::regclass
      and c.contype = 'p'
      and c.conkey = array[v_id_attnum]
  ) then
    alter table public.whitelist_emails
      add constraint whitelist_emails_pkey primary key (id);
  end if;
end;
$$;

-- Remove legacy unique constraints that enforce global uniqueness on email only.
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

-- Ensure unique email per club (same email may exist in multiple clubs).
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
