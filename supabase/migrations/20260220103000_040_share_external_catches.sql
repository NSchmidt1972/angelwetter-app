-- Allow anglers to explicitly share non-home-water catches in the public catchlist.
alter table public.fishes
  add column if not exists share_public_non_home boolean not null default false;

create index if not exists fishes_club_share_public_non_home_idx
  on public.fishes (club_id, share_public_non_home)
  where share_public_non_home = true;
