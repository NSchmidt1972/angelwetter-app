begin;

create table if not exists public.club_fish_rules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  waterbody_id uuid,
  species text not null,
  min_size_cm numeric(6,2),
  season_start_md text,
  season_end_md text,
  is_protected boolean not null default false,
  daily_limit integer,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_fish_rules_species_not_blank check (btrim(species) <> ''),
  constraint club_fish_rules_min_size_non_negative check (
    min_size_cm is null or min_size_cm >= 0
  ),
  constraint club_fish_rules_daily_limit_positive check (
    daily_limit is null or daily_limit > 0
  ),
  constraint club_fish_rules_season_start_format check (
    season_start_md is null
    or season_start_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
  ),
  constraint club_fish_rules_season_end_format check (
    season_end_md is null
    or season_end_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
  ),
  constraint club_fish_rules_season_pair check (
    (season_start_md is null and season_end_md is null)
    or (season_start_md is not null and season_end_md is not null)
  )
);

create unique index if not exists club_fish_rules_unique_scope_species_idx
  on public.club_fish_rules (club_id, coalesce(waterbody_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(species));

create index if not exists club_fish_rules_club_idx
  on public.club_fish_rules (club_id);

create index if not exists club_fish_rules_club_active_idx
  on public.club_fish_rules (club_id, is_active);

create index if not exists club_fish_rules_club_waterbody_idx
  on public.club_fish_rules (club_id, waterbody_id);

create or replace function public.set_club_fish_rules_audit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.updated_by is null then
      new.updated_by := auth.uid();
    end if;
  elsif tg_op = 'UPDATE' then
    new.updated_by := auth.uid();
  end if;

  return new;
end;
$$;

create or replace function public.seed_default_club_fish_rules(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_club_id is null then
    return;
  end if;

  insert into public.club_fish_rules (
    club_id,
    species,
    min_size_cm,
    season_start_md,
    season_end_md,
    notes,
    is_active
  )
  values
    (p_club_id, 'Aal', 50, null, null, null, true),
    (p_club_id, 'Barsch', 18, null, null, null, true),
    (p_club_id, 'Hecht', 60, '02-15', '05-31', 'Während der Schonzeit sind toter Köderfisch und alle Kunstköder verboten.', true),
    (p_club_id, 'Karpfen', 35, null, null, null, true),
    (p_club_id, 'Rotauge', 18, null, null, null, true),
    (p_club_id, 'Rotfeder', 18, null, null, null, true),
    (p_club_id, 'Schleie', 30, null, null, null, true),
    (p_club_id, 'Zander', 50, '02-15', '05-31', 'Während der Schonzeit sind toter Köderfisch und alle Kunstköder verboten.', true)
  on conflict do nothing;
end;
$$;

create or replace function public.seed_default_club_fish_rules_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_club_fish_rules(new.id);
  return new;
end;
$$;

drop trigger if exists t_set_updated_at_club_fish_rules on public.club_fish_rules;
create trigger t_set_updated_at_club_fish_rules
before update on public.club_fish_rules
for each row execute function public.set_updated_at();

drop trigger if exists t_set_club_fish_rules_audit_fields on public.club_fish_rules;
create trigger t_set_club_fish_rules_audit_fields
before insert or update on public.club_fish_rules
for each row execute function public.set_club_fish_rules_audit_fields();

drop trigger if exists t_seed_default_club_fish_rules_on_insert on public.clubs;
create trigger t_seed_default_club_fish_rules_on_insert
after insert on public.clubs
for each row execute function public.seed_default_club_fish_rules_on_insert();

grant select, insert, update, delete on table public.club_fish_rules to authenticated, service_role;
grant execute on function public.seed_default_club_fish_rules(uuid) to authenticated, service_role;

alter table public.club_fish_rules enable row level security;

drop policy if exists club_fish_rules_select on public.club_fish_rules;
create policy club_fish_rules_select
on public.club_fish_rules
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_club_member(club_id)
);

drop policy if exists club_fish_rules_insert on public.club_fish_rules;
create policy club_fish_rules_insert
on public.club_fish_rules
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

drop policy if exists club_fish_rules_update on public.club_fish_rules;
create policy club_fish_rules_update
on public.club_fish_rules
for update
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
)
with check (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

drop policy if exists club_fish_rules_delete on public.club_fish_rules;
create policy club_fish_rules_delete
on public.club_fish_rules
for delete
to authenticated
using (
  public.is_superadmin()
  or public.is_club_admin(club_id)
);

-- Backfill defaults for already existing clubs.
select public.seed_default_club_fish_rules(c.id)
from public.clubs c;

commit;
