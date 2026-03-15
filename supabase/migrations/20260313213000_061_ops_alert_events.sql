begin;

create or replace function public.is_any_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_superadmin()
    or exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.is_active = true
        and m.role::text in ('admin', 'vorstand')
    );
$$;

grant execute on function public.is_any_admin() to authenticated, service_role;

create table if not exists public.ops_alert_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  request_id uuid not null,
  source text not null,
  service text not null,
  severity text not null check (severity in ('info', 'warning', 'error', 'critical')),
  message text not null,
  release text,
  context jsonb not null default '{}'::jsonb,
  actor_user_id uuid,
  auth_kind text not null default 'unknown' check (auth_kind in ('trusted-secret', 'user', 'unknown')),
  notified boolean not null default false,
  notification_reason text,
  channels jsonb not null default '{}'::jsonb
);

create index if not exists idx_ops_alert_events_created_at
  on public.ops_alert_events (created_at desc);

create index if not exists idx_ops_alert_events_request_id
  on public.ops_alert_events (request_id);

create index if not exists idx_ops_alert_events_source_service
  on public.ops_alert_events (source, service, created_at desc);

create index if not exists idx_ops_alert_events_severity
  on public.ops_alert_events (severity, created_at desc);

alter table public.ops_alert_events enable row level security;

revoke all on table public.ops_alert_events from anon;
grant select on table public.ops_alert_events to authenticated, service_role;

drop policy if exists ops_alert_events_select_admin on public.ops_alert_events;
create policy ops_alert_events_select_admin
on public.ops_alert_events
for select
to authenticated
using (public.is_any_admin());

commit;
