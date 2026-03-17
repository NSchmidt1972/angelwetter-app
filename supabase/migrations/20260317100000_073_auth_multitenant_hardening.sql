begin;

-- Membership is the authoritative source for tenant access.
create or replace function public.is_club_member(p_club_id uuid)
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
        and m.club_id = p_club_id
        and coalesce(m.is_active, true) = true
    );
$$;

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
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.club_id = p_club_id
        and coalesce(m.is_active, true) = true
        and m.role::text in ('admin', 'vorstand')
    );
$$;

create or replace function public.current_member_role(p_club_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(
    (
      select m.role::text
      from public.memberships m
      where m.user_id = auth.uid()
        and m.club_id = p_club_id
        and coalesce(m.is_active, true) = true
      limit 1
    ),
    'gast'
  )));
$$;

-- Prevent self-role escalation via profiles writes.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert
on public.profiles
for insert
to authenticated
with check (
  public.is_superadmin()
  or (
    auth.uid() = id
    and public.is_email_whitelisted(coalesce(auth.jwt() ->> 'email', ''), club_id)
    and coalesce(role::text, 'mitglied') in ('mitglied', 'gast', 'tester')
  )
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.is_club_admin(club_id)
  or public.is_superadmin()
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or (
    auth.uid() = id
    and coalesce(role::text, 'mitglied') in ('mitglied', 'gast', 'tester')
  )
);

-- Harden anon grants to explicit public paths only.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;

grant usage on schema public to anon;
grant select on table public.clubs to anon;
grant execute on function public.is_email_whitelisted(text, uuid) to anon;

-- Ensure future objects do not get broad anon privileges by default.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

commit;
