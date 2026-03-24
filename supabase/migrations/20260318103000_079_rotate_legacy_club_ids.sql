-- Replace deterministic legacy club IDs (000... pattern) with real UUIDs.
-- Applies to existing data and keeps all referencing rows consistent.

do $$
declare
  v_fk record;
  v_col_name text;
  v_legacy_count integer;
begin
  create temporary table _legacy_club_id_map (
    old_id uuid primary key,
    new_id uuid not null unique
  ) on commit drop;

  insert into _legacy_club_id_map (old_id, new_id)
  select
    c.id,
    gen_random_uuid()
  from public.clubs c
  where c.id::text like '00000000-0000-0000-0000-0000000000%';

  get diagnostics v_legacy_count = row_count;
  if v_legacy_count = 0 then
    return;
  end if;

  create temporary table _clubs_fk_constraints
  on commit drop
  as
  select
    con.conrelid as child_oid,
    nsp.nspname as child_schema,
    cls.relname as child_table,
    con.conname,
    con.conkey,
    pg_get_constraintdef(con.oid, true) as constraint_def
  from pg_constraint con
  join pg_class cls on cls.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = cls.relnamespace
  where con.contype = 'f'
    and con.confrelid = 'public.clubs'::regclass;

  for v_fk in
    select * from _clubs_fk_constraints
  loop
    execute format(
      'alter table %I.%I drop constraint %I',
      v_fk.child_schema,
      v_fk.child_table,
      v_fk.conname
    );
  end loop;

  for v_fk in
    select * from _clubs_fk_constraints
  loop
    if coalesce(array_length(v_fk.conkey, 1), 0) <> 1 then
      raise exception
        'Expected single-column FK to public.clubs(id), found on %.% (%).',
        v_fk.child_schema,
        v_fk.child_table,
        v_fk.conname;
    end if;

    select att.attname
      into v_col_name
      from pg_attribute att
     where att.attrelid = v_fk.child_oid
       and att.attnum = v_fk.conkey[1]
       and not att.attisdropped;

    if v_col_name is null then
      raise exception
        'Could not resolve FK column for %.% (%).',
        v_fk.child_schema,
        v_fk.child_table,
        v_fk.conname;
    end if;

    execute format(
      'update %I.%I t set %I = m.new_id from _legacy_club_id_map m where t.%I = m.old_id',
      v_fk.child_schema,
      v_fk.child_table,
      v_col_name,
      v_col_name
    );
  end loop;

  update public.clubs c
     set id = m.new_id
    from _legacy_club_id_map m
   where c.id = m.old_id;

  for v_fk in
    select * from _clubs_fk_constraints
  loop
    execute format(
      'alter table %I.%I add constraint %I %s',
      v_fk.child_schema,
      v_fk.child_table,
      v_fk.conname,
      v_fk.constraint_def
    );
  end loop;

  raise notice 'Rotated % legacy club id(s) to generated UUIDs.', v_legacy_count;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clubs'::regclass
      and conname = 'clubs_id_not_legacy_zero_prefix'
  ) then
    alter table public.clubs
      add constraint clubs_id_not_legacy_zero_prefix
      check (id::text not like '00000000-0000-0000-0000-0000000000%');
  end if;
end
$$;
