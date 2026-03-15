begin;

-- Module and role-matrix management is restricted to club admins (and superadmins).
drop policy if exists club_features_manage on public.club_features;
create policy club_features_manage
on public.club_features
for all
to authenticated
using (
  public.is_superadmin()
  or public.is_role_at_least(public.current_member_role(club_id), 'admin')
)
with check (
  public.is_superadmin()
  or public.is_role_at_least(public.current_member_role(club_id), 'admin')
);

drop policy if exists club_role_features_manage on public.club_role_features;
create policy club_role_features_manage
on public.club_role_features
for all
to authenticated
using (
  public.is_superadmin()
  or public.is_role_at_least(public.current_member_role(club_id), 'admin')
)
with check (
  public.is_superadmin()
  or public.is_role_at_least(public.current_member_role(club_id), 'admin')
);

commit;
