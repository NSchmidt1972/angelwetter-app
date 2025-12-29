-- Superadmin-Whitelist + RLS-Anpassungen für club-übergreifende Sichten

-- 1) Superadmin-Tabelle
create table if not exists public.superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.superadmins enable row level security;
-- RLS: Superadmins dürfen sich selbst sehen; Admin-Pflege via Service Role
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'sa_self_select') then
    create policy sa_self_select on public.superadmins
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- 2) Helper-Funktion (bypass RLS, security definer)
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.superadmins where user_id = auth.uid());
$$;
grant execute on function public.is_superadmin() to authenticated, service_role;

-- 3) Hilfsfunktion für Club-Admin/Vorstand (bereits genutzt)
create or replace function public.is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_superadmin()
    or exists (
      select 1 from public.memberships
      where user_id = auth.uid()
        and club_id = p_club_id
        and role in ('admin','vorstand')
        and is_active = true
    );
$$;
grant execute on function public.is_club_admin(uuid) to authenticated, service_role;

-- 4) RLS-Anpassungen für club-übergreifende Sicht (Superadmin)
-- memberships
drop policy if exists m_select on public.memberships;
drop policy if exists m_insert on public.memberships;
drop policy if exists m_update on public.memberships;

create policy m_select on public.memberships
  for select using (
    public.is_superadmin()
    or user_id = auth.uid()
    or public.is_club_admin(club_id)
  );

create policy m_insert on public.memberships
  for insert with check (
    public.is_superadmin()
    or user_id = auth.uid()
    or public.is_club_admin(club_id)
  );

create policy m_update on public.memberships
  for update using (
    public.is_superadmin()
    or user_id = auth.uid()
    or public.is_club_admin(club_id)
  )
  with check (
    public.is_superadmin()
    or user_id = auth.uid()
    or public.is_club_admin(club_id)
  );

-- clubs: Superadmin darf alle sehen
drop policy if exists clubs_select_all on public.clubs;
create policy clubs_select_all on public.clubs for select using (true);

-- fishes
drop policy if exists fishes_select_club on public.fishes;
drop policy if exists fishes_insert_club on public.fishes;
drop policy if exists fishes_update_club on public.fishes;

create policy fishes_select_club on public.fishes
  for select using (
    public.is_superadmin()
    or club_id in (select club_id from public.memberships where user_id = auth.uid() and is_active)
  );
create policy fishes_insert_club on public.fishes
  for insert with check (
    public.is_superadmin()
    or club_id in (select club_id from public.memberships where user_id = auth.uid() and is_active)
  );
create policy fishes_update_club on public.fishes
  for update using (
    public.is_superadmin()
    or club_id in (select club_id from public.memberships where user_id = auth.uid() and is_active)
  );

-- user_activity
drop policy if exists ua_select_club on public.user_activity;
drop policy if exists ua_upsert_club on public.user_activity;
drop policy if exists ua_update_club on public.user_activity;

create policy ua_select_club on public.user_activity
  for select using (
    public.is_superadmin()
    or club_id in (select club_id from public.memberships where user_id = auth.uid() and is_active)
  );
create policy ua_upsert_club on public.user_activity
  for insert with check (
    public.is_superadmin()
    or club_id in (select club_id from public.memberships where user_id = auth.uid() and is_active)
  );
create policy ua_update_club on public.user_activity
  for update using (
    public.is_superadmin()
    or club_id in (select club_id from public.memberships where user_id = auth.uid() and is_active)
  );

-- push_subscriptions
drop policy if exists push_select_club on public.push_subscriptions;
drop policy if exists push_insert_club on public.push_subscriptions;
drop policy if exists push_update_club on public.push_subscriptions;

create policy push_select_club on public.push_subscriptions
  for select using (
    public.is_superadmin()
    or club_id in (select club_id from public.memberships where user_id = auth.uid() and is_active)
  );
create policy push_insert_club on public.push_subscriptions
  for insert with check (
    public.is_superadmin()
    or club_id in (select club_id from public.memberships where user_id = auth.uid() and is_active)
  );
create policy push_update_club on public.push_subscriptions
  for update using (
    public.is_superadmin()
    or club_id in (select club_id from public.memberships where user_id = auth.uid() and is_active)
  );

-- 5) Superadmin vergeben (Beispiel): nach Bedarf ausführen
-- insert into public.superadmins (user_id) values ('<deine-auth-user-id>') on conflict do nothing;
