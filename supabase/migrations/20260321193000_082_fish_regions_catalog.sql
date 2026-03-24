begin;

create table if not exists public.fish_regions (
  id text primary key,
  label text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fish_regions_id_format check (id ~ '^[a-z0-9_]+$'),
  constraint fish_regions_label_not_blank check (btrim(label) <> '')
);

create table if not exists public.fish_region_species (
  id uuid primary key default gen_random_uuid(),
  region_id text not null references public.fish_regions(id) on delete cascade,
  species text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fish_region_species_species_not_blank check (btrim(species) <> '')
);

create unique index if not exists fish_region_species_region_species_unique_idx
  on public.fish_region_species (region_id, lower(btrim(species)));

create index if not exists fish_regions_sort_idx
  on public.fish_regions (sort_order, id);

create index if not exists fish_region_species_region_sort_idx
  on public.fish_region_species (region_id, sort_order, species);

create index if not exists fish_region_species_region_active_idx
  on public.fish_region_species (region_id, is_active);

-- updated_at trigger wiring

drop trigger if exists t_set_updated_at_fish_regions on public.fish_regions;
create trigger t_set_updated_at_fish_regions
before update on public.fish_regions
for each row execute function public.set_updated_at();

drop trigger if exists t_set_updated_at_fish_region_species on public.fish_region_species;
create trigger t_set_updated_at_fish_region_species
before update on public.fish_region_species
for each row execute function public.set_updated_at();

-- Vereinsgewässer-Fischarten werden ausschließlich clubspezifisch über club_fish_rules gepflegt.
-- Falls aus einem vorherigen Stand globale Vereinsgewässer-Arten vorhanden sind, entfernen.
delete from public.fish_region_species
where region_id = 'ferkensbruch';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fish_region_species_no_homewater'
  ) then
    alter table public.fish_region_species
      add constraint fish_region_species_no_homewater
      check (region_id <> 'ferkensbruch');
  end if;
end $$;

-- Seed default regions (previously hardcoded in frontend)
insert into public.fish_regions (id, label, sort_order, is_active)
values
  ('ferkensbruch', 'Vereinsgewässer', 10, true),
  ('inland', 'Binnen (Deutschland)', 20, true),
  ('holland', 'Niederlande (Binnen & Polder)', 30, true),
  ('northsea_de', 'Nordsee (DE)', 40, true),
  ('baltic_de', 'Ostsee (DE)', 50, true),
  ('med', 'Mittelmeer (Kreta)', 60, true),
  ('norway', 'Norwegen (Salzwasser)', 70, true)
on conflict (id) do nothing;

insert into public.fish_region_species (region_id, species, sort_order, is_active)
select seed.region_id, seed.species, seed.sort_order, seed.is_active
from (
  values
    -- Binnen Deutschland
    ('inland', 'Aal', 10, true),
    ('inland', 'Barsch', 20, true),
    ('inland', 'Brasse', 30, true),
    ('inland', 'Forelle', 40, true),
    ('inland', 'Güster', 50, true),
    ('inland', 'Gründling', 60, true),
    ('inland', 'Grundel', 70, true),
    ('inland', 'Hecht', 80, true),
    ('inland', 'Karausche', 90, true),
    ('inland', 'Karpfen', 100, true),
    ('inland', 'Rotauge', 110, true),
    ('inland', 'Rotfeder', 120, true),
    ('inland', 'Schleie', 130, true),
    ('inland', 'Wels', 140, true),
    ('inland', 'Zander', 150, true),

    -- Niederlande
    ('holland', 'Aal', 10, true),
    ('holland', 'Barsch', 20, true),
    ('holland', 'Brasse', 30, true),
    ('holland', 'Döbel', 40, true),
    ('holland', 'Hecht', 50, true),
    ('holland', 'Karpfen', 60, true),
    ('holland', 'Nase', 70, true),
    ('holland', 'Quappe', 80, true),
    ('holland', 'Rapfen', 90, true),
    ('holland', 'Rotauge', 100, true),
    ('holland', 'Rotfeder', 110, true),
    ('holland', 'Schleie', 120, true),
    ('holland', 'Wels', 130, true),
    ('holland', 'Zander', 140, true),

    -- Nordsee DE
    ('northsea_de', 'Dorsch (Kabeljau)', 10, true),
    ('northsea_de', 'Wittling', 20, true),
    ('northsea_de', 'Seelachs (Köhler)', 30, true),
    ('northsea_de', 'Makrele', 40, true),
    ('northsea_de', 'Scholle', 50, true),
    ('northsea_de', 'Kliesche', 60, true),
    ('northsea_de', 'Flunder', 70, true),
    ('northsea_de', 'Steinbutt', 80, true),
    ('northsea_de', 'Seezunge', 90, true),
    ('northsea_de', 'Hering', 100, true),
    ('northsea_de', 'Meeräsche', 110, true),
    ('northsea_de', 'Seehecht', 120, true),
    ('northsea_de', 'Seeteufel', 130, true),

    -- Ostsee DE
    ('baltic_de', 'Dorsch (Kabeljau)', 10, true),
    ('baltic_de', 'Hering', 20, true),
    ('baltic_de', 'Hornhecht', 30, true),
    ('baltic_de', 'Meerforelle', 40, true),
    ('baltic_de', 'Lachs', 50, true),
    ('baltic_de', 'Scholle', 60, true),
    ('baltic_de', 'Flunder', 70, true),
    ('baltic_de', 'Kliesche', 80, true),
    ('baltic_de', 'Steinbutt', 90, true),
    ('baltic_de', 'Aal', 100, true),
    ('baltic_de', 'Plattfisch (allg.)', 110, true),

    -- Mittelmeer Kreta
    ('med', 'Amberjack (Bernsteinfisch) (Seriola dumerili – Μαγιάτικο)', 10, true),
    ('med', 'Barrakuda (Sphyraena viridensis – Λούτσος)', 20, true),
    ('med', 'Bluefish (Blaufisch) (Pomatomus saltatrix – Γαύρος ή Λαυράκι της θάλασσας)', 30, true),
    ('med', 'Bonito (Sarda sarda – Πελές ή Παλαμίδα)', 40, true),
    ('med', 'Comber (Serranus cabrilla – Σαργομπαλάς)', 50, true),
    ('med', 'Dorade (Goldbrasse) (Sparus aurata – Τσιπούρα)', 60, true),
    ('med', 'Fagri (Rotbrasse) (Pagrus pagrus – Φαγκρί)', 70, true),
    ('med', 'Feuerfisch (Pterois miles – Λεοντόψαρο)', 80, true),
    ('med', 'Makrele (Scomber scombrus – Σκουμπρί)', 90, true),
    ('med', 'Meeräsche (Mugil cephalus – Κέφαλος)', 100, true),
    ('med', 'Meerjunker (Coris julis – Γαϊδουρόψαρο)', 110, true),
    ('med', 'Oktopus (Octopus vulgaris – Χταπόδι)', 120, true),
    ('med', 'Pandora (Pagellus erythrinus – Λυθρίνι)', 130, true),
    ('med', 'Petermännchen (Trachinus draco – Δράκαινα)', 140, true),
    ('med', 'Rotbarbe (Mullus surmuletus – Μπαρμπούνι)', 150, true),
    ('med', 'Rotzahn-Doktorfisch (Skaros) (Sparisoma cretense – Σκάρος)', 160, true),
    ('med', 'Sardine (Sardina pilchardus – Σαρδέλα)', 170, true),
    ('med', 'Scharfbrasse (Diplodus puntazzo – Σαργός)', 180, true),
    ('med', 'Sepia (Sepia officinalis – Σουπιά)', 190, true),
    ('med', 'Skorpionfisch (Scorpaena notata – Σκορπίδι)', 200, true),
    ('med', 'Thunfisch (Thunnus thynnus – Τόνος)', 210, true),
    ('med', 'Tintenfisch (Kalmar) (Loligo vulgaris – Καλαμάρι)', 220, true),
    ('med', 'Weißbrasse (Diplodus sargus – Σπάρος)', 230, true),
    ('med', 'Wolfsbarsch (Seebarsch) (Dicentrarchus labrax – Λαβράκι)', 240, true),
    ('med', 'Zackenbarsch (Epinephelus costae – Σφυρίδα)', 250, true),

    -- Norwegen
    ('norway', 'Dorsch (Kabeljau)', 10, true),
    ('norway', 'Seelachs (Köhler)', 20, true),
    ('norway', 'Leng', 30, true),
    ('norway', 'Lumb', 40, true),
    ('norway', 'Rotbarsch', 50, true),
    ('norway', 'Heilbutt', 60, true),
    ('norway', 'Seeteufel', 70, true),
    ('norway', 'Makrele', 80, true),
    ('norway', 'Scholle', 90, true),
    ('norway', 'Steinbeißer', 100, true),
    ('norway', 'Seehecht', 110, true)
) as seed(region_id, species, sort_order, is_active)
where not exists (
  select 1
  from public.fish_region_species existing
  where existing.region_id = seed.region_id
    and lower(btrim(existing.species)) = lower(btrim(seed.species))
);

grant select, insert, update, delete on table public.fish_regions to authenticated, service_role;
grant select, insert, update, delete on table public.fish_region_species to authenticated, service_role;

alter table public.fish_regions enable row level security;
alter table public.fish_region_species enable row level security;

drop policy if exists fish_regions_select on public.fish_regions;
create policy fish_regions_select
on public.fish_regions
for select
to authenticated
using (
  is_active = true
  or public.is_superadmin()
);

drop policy if exists fish_regions_manage on public.fish_regions;
create policy fish_regions_manage
on public.fish_regions
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists fish_region_species_select on public.fish_region_species;
create policy fish_region_species_select
on public.fish_region_species
for select
to authenticated
using (
  public.is_superadmin()
  or (
    is_active = true
    and exists (
      select 1
      from public.fish_regions r
      where r.id = fish_region_species.region_id
        and r.is_active = true
    )
  )
);

drop policy if exists fish_region_species_manage on public.fish_region_species;
create policy fish_region_species_manage
on public.fish_region_species
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

commit;
