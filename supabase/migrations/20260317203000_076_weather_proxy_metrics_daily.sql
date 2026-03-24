begin;

create table if not exists public.weather_proxy_metrics_daily (
  club_id uuid not null references public.clubs(id) on delete cascade,
  metric_date date not null,
  request_count bigint not null default 0 check (request_count >= 0),
  cache_hit_count bigint not null default 0 check (cache_hit_count >= 0),
  cache_miss_count bigint not null default 0 check (cache_miss_count >= 0),
  openweather_call_count bigint not null default 0 check (openweather_call_count >= 0),
  secondary_key_count bigint not null default 0 check (secondary_key_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (club_id, metric_date)
);

create index if not exists weather_proxy_metrics_daily_metric_date_idx
  on public.weather_proxy_metrics_daily (metric_date desc);

create or replace function public.bump_weather_proxy_metric(
  p_club_id uuid,
  p_metric_date date default (timezone('utc', now()))::date,
  p_request_count integer default 0,
  p_cache_hit_count integer default 0,
  p_cache_miss_count integer default 0,
  p_openweather_call_count integer default 0,
  p_secondary_key_count integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_club_id is null then
    return;
  end if;

  insert into public.weather_proxy_metrics_daily (
    club_id,
    metric_date,
    request_count,
    cache_hit_count,
    cache_miss_count,
    openweather_call_count,
    secondary_key_count,
    created_at,
    updated_at
  )
  values (
    p_club_id,
    coalesce(p_metric_date, (timezone('utc', now()))::date),
    greatest(coalesce(p_request_count, 0), 0),
    greatest(coalesce(p_cache_hit_count, 0), 0),
    greatest(coalesce(p_cache_miss_count, 0), 0),
    greatest(coalesce(p_openweather_call_count, 0), 0),
    greatest(coalesce(p_secondary_key_count, 0), 0),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (club_id, metric_date)
  do update
  set
    request_count = public.weather_proxy_metrics_daily.request_count + greatest(coalesce(p_request_count, 0), 0),
    cache_hit_count = public.weather_proxy_metrics_daily.cache_hit_count + greatest(coalesce(p_cache_hit_count, 0), 0),
    cache_miss_count = public.weather_proxy_metrics_daily.cache_miss_count + greatest(coalesce(p_cache_miss_count, 0), 0),
    openweather_call_count = public.weather_proxy_metrics_daily.openweather_call_count + greatest(coalesce(p_openweather_call_count, 0), 0),
    secondary_key_count = public.weather_proxy_metrics_daily.secondary_key_count + greatest(coalesce(p_secondary_key_count, 0), 0),
    updated_at = timezone('utc', now());
end;
$$;

alter table public.weather_proxy_metrics_daily enable row level security;

drop policy if exists weather_proxy_metrics_daily_select on public.weather_proxy_metrics_daily;
create policy weather_proxy_metrics_daily_select
on public.weather_proxy_metrics_daily
for select
to authenticated
using (public.is_superadmin());

drop policy if exists weather_proxy_metrics_daily_manage_superadmin on public.weather_proxy_metrics_daily;
create policy weather_proxy_metrics_daily_manage_superadmin
on public.weather_proxy_metrics_daily
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

grant select on table public.weather_proxy_metrics_daily to authenticated, service_role;
grant insert, update on table public.weather_proxy_metrics_daily to service_role;

revoke all on function public.bump_weather_proxy_metric(uuid, date, integer, integer, integer, integer, integer) from public;
revoke all on function public.bump_weather_proxy_metric(uuid, date, integer, integer, integer, integer, integer) from anon;
revoke all on function public.bump_weather_proxy_metric(uuid, date, integer, integer, integer, integer, integer) from authenticated;
grant execute on function public.bump_weather_proxy_metric(uuid, date, integer, integer, integer, integer, integer) to service_role;

commit;
