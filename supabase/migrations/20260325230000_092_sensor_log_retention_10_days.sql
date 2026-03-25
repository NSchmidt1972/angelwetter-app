begin;

create or replace function public.prune_sensor_logs(p_keep_days integer default 10)
returns table(log_table text, deleted_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep_days integer := greatest(1, least(coalesce(p_keep_days, 10), 365));
  v_cutoff timestamptz := timezone('utc', now()) - make_interval(days => v_keep_days);
  v_deleted bigint := 0;
begin
  if to_regclass('public.batt_log') is not null then
    execute 'delete from public.batt_log where coalesce(measured_at, created_at) < $1'
    using v_cutoff;
    get diagnostics v_deleted = row_count;
    return query select 'batt_log'::text, v_deleted;
  end if;

  if to_regclass('public.gps_log') is not null then
    execute 'delete from public.gps_log where coalesce(fix_time_utc, created_at) < $1'
    using v_cutoff;
    get diagnostics v_deleted = row_count;
    return query select 'gps_log'::text, v_deleted;
  end if;

  if to_regclass('public.temperature_log') is not null then
    execute 'delete from public.temperature_log where coalesce(measured_at, created_at) < $1'
    using v_cutoff;
    get diagnostics v_deleted = row_count;
    return query select 'temperature_log'::text, v_deleted;
  end if;
end;
$$;

revoke all on function public.prune_sensor_logs(integer) from public, anon, authenticated;
grant execute on function public.prune_sensor_logs(integer) to service_role;

-- Initial cleanup for existing data.
select * from public.prune_sensor_logs(10);

do $$
declare
  v_job_name constant text := 'sensor_log_retention_10_days_hourly';
  v_schedule constant text := '17 * * * *';
  v_command constant text := 'select public.prune_sensor_logs(10);';
  v_has_jobname boolean := false;
begin
  begin
    if exists (
      select 1
      from pg_available_extensions
      where name = 'pg_cron'
    ) then
      create extension if not exists pg_cron;
    end if;
  exception
    when others then
      raise notice 'pg_cron could not be enabled: %', sqlerrm;
  end;

  if to_regclass('cron.job') is null then
    raise notice 'cron.job not found; skipping sensor retention scheduler.';
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'cron'
      and table_name = 'job'
      and column_name = 'jobname'
  )
  into v_has_jobname;

  if v_has_jobname then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = v_job_name;
  else
    perform cron.unschedule(jobid)
    from cron.job
    where command = v_command;
  end if;

  begin
    if exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'cron'
        and p.proname = 'schedule'
        and pg_get_function_identity_arguments(p.oid) = 'job_name text, schedule text, command text'
    ) then
      perform cron.schedule(v_job_name, v_schedule, v_command);
    else
      perform cron.schedule(v_schedule, v_command);
    end if;
  exception
    when others then
      raise notice 'Could not schedule sensor retention job: %', sqlerrm;
  end;
end;
$$;

commit;
