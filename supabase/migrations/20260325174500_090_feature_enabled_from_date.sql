begin;

alter table if exists public.club_features
  add column if not exists enabled_from_date date;

create or replace function public.is_feature_enabled(p_club_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_features cf
    where cf.club_id = p_club_id
      and cf.feature_key = lower(trim(coalesce(p_feature_key, '')))
      and cf.enabled = true
      and (
        cf.enabled_from_date is null
        or cf.enabled_from_date <= (timezone('utc', now()))::date
      )
  );
$$;

create or replace function public.guard_club_feature_enabled_from_date_superadmin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    if tg_op = 'INSERT' then
      if new.enabled_from_date is not null then
        raise exception 'forbidden';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.enabled_from_date is distinct from old.enabled_from_date then
        raise exception 'forbidden';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists t_guard_club_feature_enabled_from_date_superadmin on public.club_features;
create trigger t_guard_club_feature_enabled_from_date_superadmin
before insert or update on public.club_features
for each row execute function public.guard_club_feature_enabled_from_date_superadmin();

commit;
