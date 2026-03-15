begin;

create or replace function public.superadmin_resolve_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where public.is_superadmin()
    and lower(trim(coalesce(u.email, ''))) = lower(trim(coalesce(p_email, '')))
  order by u.created_at asc
  limit 1;
$$;

revoke all on function public.superadmin_resolve_user_id_by_email(text) from public;
revoke all on function public.superadmin_resolve_user_id_by_email(text) from anon;
grant execute on function public.superadmin_resolve_user_id_by_email(text) to authenticated, service_role;

commit;
