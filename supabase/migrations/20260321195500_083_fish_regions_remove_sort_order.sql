begin;

drop index if exists fish_regions_sort_idx;
drop index if exists fish_region_species_region_sort_idx;

alter table if exists public.fish_regions
  drop column if exists sort_order;

alter table if exists public.fish_region_species
  drop column if exists sort_order;

create index if not exists fish_regions_label_idx
  on public.fish_regions (label, id);

create index if not exists fish_region_species_region_species_idx
  on public.fish_region_species (region_id, species);

commit;
