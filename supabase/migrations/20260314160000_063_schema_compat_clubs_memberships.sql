-- Compatibility backfill for older tenant schemas
-- Ensures new permissions/superadmin code can rely on clubs.is_active and memberships.updated_at.

alter table public.clubs
  add column if not exists is_active boolean;

update public.clubs
set is_active = true
where is_active is null;

alter table public.clubs
  alter column is_active set default true;

alter table public.clubs
  alter column is_active set not null;

alter table public.clubs
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.memberships
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop trigger if exists t_set_updated_at_clubs on public.clubs;
create trigger t_set_updated_at_clubs
before update on public.clubs
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_memberships on public.memberships;
create trigger t_set_updated_at_memberships
before update on public.memberships
for each row execute function public.set_updated_at();
