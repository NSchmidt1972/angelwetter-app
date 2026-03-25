begin;

do $$
declare
  v_old_device_id constant text := 'asv';
  v_new_device_id constant text := 'esp32-E0516B76EFD0';
  v_row record;
  v_sql text;
  v_updated_count bigint;
begin
  if nullif(btrim(v_old_device_id), '') is null then
    raise exception 'Old device_id must not be empty.';
  end if;
  if nullif(btrim(v_new_device_id), '') is null then
    raise exception 'New device_id must not be empty.';
  end if;
  if lower(btrim(v_old_device_id)) = lower(btrim(v_new_device_id)) then
    raise notice 'Device IDs are identical after normalization. Nothing to update.';
    return;
  end if;

  for v_row in
    select c.table_schema, c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'device_id'
      and t.table_type = 'BASE TABLE'
      and (
        c.data_type in ('text', 'character varying', 'character')
        or c.udt_name = 'citext'
      )
    order by c.table_name
  loop
    v_sql := format(
      'update %I.%I set %I = $1 where lower(btrim(%I)) = lower($2)',
      v_row.table_schema,
      v_row.table_name,
      v_row.column_name,
      v_row.column_name
    );
    execute v_sql using v_new_device_id, v_old_device_id;
    get diagnostics v_updated_count = row_count;
    raise notice 'Updated % row(s) in %.%', v_updated_count, v_row.table_schema, v_row.table_name;
  end loop;
end;
$$;

commit;
