begin;

alter table public.whitelist_emails
  add column if not exists role text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.whitelist_emails'::regclass
      and conname = 'whitelist_emails_role_check'
  ) then
    alter table public.whitelist_emails
      add constraint whitelist_emails_role_check
      check (
        role is null
        or role in ('mitglied', 'vorstand', 'admin', 'gast', 'tester', 'inactive')
      );
  end if;
end
$$;

create or replace function public.whitelist_role_for_email(p_email text, p_club_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select nullif(trim(w.role), '')
      from public.whitelist_emails w
      where w.club_id = p_club_id
        and lower(trim(coalesce(w.email::text, ''))) = lower(trim(coalesce(p_email, '')))
      order by w.created_at asc
      limit 1
    ),
    'mitglied'
  );
$$;

revoke all on function public.whitelist_role_for_email(text, uuid) from public;
revoke all on function public.whitelist_role_for_email(text, uuid) from anon;
grant execute on function public.whitelist_role_for_email(text, uuid) to anon, authenticated, service_role;

commit;
