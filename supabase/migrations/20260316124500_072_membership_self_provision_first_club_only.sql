begin;

drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert
on public.memberships
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
  or (
    auth.uid() = user_id
    and is_active = true
    and role in ('mitglied', 'gast', 'tester')
    and public.is_email_whitelisted(coalesce(auth.jwt() ->> 'email', ''), club_id)
    and not exists (
      select 1
      from public.memberships existing
      where existing.user_id = auth.uid()
    )
  )
);

commit;
