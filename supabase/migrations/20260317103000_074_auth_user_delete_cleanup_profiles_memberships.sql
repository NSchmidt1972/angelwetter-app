begin;

-- Remove orphaned/soft-deleted user rows before tightening constraints.
delete from public.memberships m
where not exists (
  select 1
  from auth.users u
  where u.id = m.user_id
)
or exists (
  select 1
  from auth.users u
  where u.id = m.user_id
    and u.deleted_at is not null
);

delete from public.profiles p
where not exists (
  select 1
  from auth.users u
  where u.id = p.id
)
or exists (
  select 1
  from auth.users u
  where u.id = p.id
    and u.deleted_at is not null
);

-- Ensure FK on profiles.id -> auth.users(id) uses ON DELETE CASCADE.
do $$
declare
  v_attnum smallint;
  v_constraint record;
begin
  select a.attnum
    into v_attnum
  from pg_attribute a
  where a.attrelid = 'public.profiles'::regclass
    and a.attname = 'id'
    and a.attisdropped = false;

  if v_attnum is null then
    return;
  end if;

  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'f'
      and c.conkey = array[v_attnum]
  loop
    execute format(
      'alter table public.profiles drop constraint if exists %I',
      v_constraint.conname
    );
  end loop;

  alter table public.profiles
    add constraint profiles_id_fkey
    foreign key (id)
    references auth.users(id)
    on delete cascade;
end
$$;

-- Ensure FK on memberships.user_id -> auth.users(id) uses ON DELETE CASCADE.
do $$
declare
  v_attnum smallint;
  v_constraint record;
begin
  select a.attnum
    into v_attnum
  from pg_attribute a
  where a.attrelid = 'public.memberships'::regclass
    and a.attname = 'user_id'
    and a.attisdropped = false;

  if v_attnum is null then
    return;
  end if;

  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.memberships'::regclass
      and c.contype = 'f'
      and c.conkey = array[v_attnum]
  loop
    execute format(
      'alter table public.memberships drop constraint if exists %I',
      v_constraint.conname
    );
  end loop;

  alter table public.memberships
    add constraint memberships_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete cascade;
end
$$;

-- Cleanup for both hard deletes and soft deletes (deleted_at) in auth.users.
create or replace function public.cleanup_user_artifacts_from_auth_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := coalesce(new.id, old.id);
  if v_user_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and not (
    new.deleted_at is not null
    and old.deleted_at is distinct from new.deleted_at
  ) then
    return new;
  end if;

  delete from public.memberships where user_id = v_user_id;
  delete from public.profiles where id = v_user_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.cleanup_user_artifacts_from_auth_users() from public;
revoke all on function public.cleanup_user_artifacts_from_auth_users() from anon;
revoke all on function public.cleanup_user_artifacts_from_auth_users() from authenticated;

drop trigger if exists t_cleanup_user_artifacts_after_auth_user_delete on auth.users;
create trigger t_cleanup_user_artifacts_after_auth_user_delete
after delete on auth.users
for each row
execute function public.cleanup_user_artifacts_from_auth_users();

drop trigger if exists t_cleanup_user_artifacts_after_auth_user_soft_delete on auth.users;
create trigger t_cleanup_user_artifacts_after_auth_user_soft_delete
after update of deleted_at on auth.users
for each row
when (new.deleted_at is not null and old.deleted_at is distinct from new.deleted_at)
execute function public.cleanup_user_artifacts_from_auth_users();

commit;
