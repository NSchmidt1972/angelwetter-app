begin;

do $$
begin
  if to_regclass('public.temperature_log') is not null then
    execute $sql$
      with ranked as (
        select
          ctid,
          row_number() over (
            partition by device_id, topic, measured_at
            order by created_at desc nulls last, ctid desc
          ) as rn
        from public.temperature_log
      )
      delete from public.temperature_log t
      using ranked r
      where t.ctid = r.ctid
        and r.rn > 1
    $sql$;

    execute
      'create unique index if not exists temperature_log_device_topic_measured_at_uniq
       on public.temperature_log (device_id, topic, measured_at) nulls not distinct';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.batt_log') is not null then
    execute $sql$
      with ranked as (
        select
          ctid,
          row_number() over (
            partition by device_id, topic, measured_at
            order by created_at desc nulls last, ctid desc
          ) as rn
        from public.batt_log
      )
      delete from public.batt_log t
      using ranked r
      where t.ctid = r.ctid
        and r.rn > 1
    $sql$;

    execute
      'create unique index if not exists batt_log_device_topic_measured_at_uniq
       on public.batt_log (device_id, topic, measured_at) nulls not distinct';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.gps_log') is not null then
    execute $sql$
      with ranked as (
        select
          ctid,
          row_number() over (
            partition by device_id, topic, fix_time_utc, lat, lon
            order by created_at desc nulls last, ctid desc
          ) as rn
        from public.gps_log
      )
      delete from public.gps_log t
      using ranked r
      where t.ctid = r.ctid
        and r.rn > 1
    $sql$;

    execute
      'create unique index if not exists gps_log_device_topic_fix_time_lat_lon_uniq
       on public.gps_log (device_id, topic, fix_time_utc, lat, lon) nulls not distinct';
  end if;
end;
$$;

commit;
