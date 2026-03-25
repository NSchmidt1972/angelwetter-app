import { supabase } from '@/supabaseClient';
import { DEFAULT_REGION_OPTIONS, regionFishMapFallback } from '@/constants/fishRegions';

const HOME_WATER_REGION_ID = 'ferkensbruch';
const HOME_WATER_REGION_LABEL = 'Vereinsgewässer';

function asTrimmedString(value) {
  return String(value || '').trim();
}

function normalizeRegionId(value) {
  return asTrimmedString(value)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 64);
}

function mapRegionRows(regionRows) {
  return (Array.isArray(regionRows) ? regionRows : []).map((row) => ({
    id: asTrimmedString(row?.id),
    label: asTrimmedString(row?.label),
    is_active: row?.is_active !== false,
  }));
}

function mapSpeciesRows(speciesRows) {
  return (Array.isArray(speciesRows) ? speciesRows : []).map((row) => ({
    id: row?.id || null,
    region_id: asTrimmedString(row?.region_id),
    species: asTrimmedString(row?.species),
    is_active: row?.is_active !== false,
  }));
}

function fallbackCatalog() {
  return {
    regions: DEFAULT_REGION_OPTIONS.map((entry) => ({
      id: entry.id,
      label: entry.label,
      is_active: true,
    })),
    species: Object.entries(regionFishMapFallback()).flatMap(([regionId, fishes]) =>
      fishes.map((species, index) => ({
        id: `${regionId}-${index}-${species}`,
        region_id: regionId,
        species,
        is_active: true,
      }))
    ),
    fromFallback: true,
  };
}

function buildPublicMap({ regions, species }) {
  const regionOptions = [];
  const regionFishMap = {};
  const activeRegions = regions.filter((row) => row.is_active);
  const homeWaterRegion = activeRegions.find((row) => row.id === HOME_WATER_REGION_ID)
    || { id: HOME_WATER_REGION_ID, label: HOME_WATER_REGION_LABEL, is_active: true };
  const remainingRegions = activeRegions
    .filter((row) => row.id !== HOME_WATER_REGION_ID)
    .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }))
  const visibleRegions = [homeWaterRegion, ...remainingRegions];

  visibleRegions.forEach((region) => {
    regionOptions.push({ id: region.id, label: region.label });
    regionFishMap[region.id] = [];
  });

  species
    .filter((row) => row.is_active && Boolean(regionFishMap[row.region_id]))
    .sort((a, b) => a.species.localeCompare(b.species, 'de', { sensitivity: 'base' }))
    .forEach((row) => {
      regionFishMap[row.region_id].push(row.species);
    });

  return { regionOptions, regionFishMap };
}

export async function fetchFishRegionCatalog() {
  const [regionsResult, speciesResult] = await Promise.all([
    supabase
      .from('fish_regions')
      .select('id, label, is_active')
      .order('label', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('fish_region_species')
      .select('id, region_id, species, is_active')
      .order('region_id', { ascending: true })
      .order('species', { ascending: true }),
  ]);

  if (regionsResult.error || speciesResult.error) {
    const fallback = fallbackCatalog();
    const mapped = buildPublicMap({
      regions: fallback.regions,
      species: fallback.species,
    });

    return {
      ...mapped,
      fromFallback: true,
      error: regionsResult.error || speciesResult.error,
    };
  }

  const regions = mapRegionRows(regionsResult.data);
  const species = mapSpeciesRows(speciesResult.data);
  const mapped = buildPublicMap({ regions, species });

  if (mapped.regionOptions.length === 0) {
    const fallback = fallbackCatalog();
    const fallbackMapped = buildPublicMap({
      regions: fallback.regions,
      species: fallback.species,
    });
    return {
      ...fallbackMapped,
      fromFallback: true,
      error: null,
    };
  }

  return {
    ...mapped,
    fromFallback: false,
    error: null,
  };
}

export async function fetchFishRegionCatalogForSuperadmin() {
  const [regionsResult, speciesResult] = await Promise.all([
    supabase
      .from('fish_regions')
      .select('id, label, is_active')
      .order('label', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('fish_region_species')
      .select('id, region_id, species, is_active')
      .order('region_id', { ascending: true })
      .order('species', { ascending: true }),
  ]);

  if (regionsResult.error) throw new Error(regionsResult.error.message || 'Regionen konnten nicht geladen werden.');
  if (speciesResult.error) throw new Error(speciesResult.error.message || 'Fischarten konnten nicht geladen werden.');

  return {
    regions: mapRegionRows(regionsResult.data),
    species: mapSpeciesRows(speciesResult.data),
  };
}

export async function createFishRegion(input) {
  const normalizedId = normalizeRegionId(input?.id);
  const label = asTrimmedString(input?.label);
  if (!normalizedId) throw new Error('Region-ID fehlt oder ist ungültig.');
  if (!label) throw new Error('Region-Name fehlt.');

  const payload = {
    id: normalizedId,
    label,
    is_active: input?.is_active !== false,
  };

  const { data, error } = await supabase
    .from('fish_regions')
    .insert(payload)
    .select('id, label, is_active')
    .single();

  if (error?.code === '23505') throw new Error('Region-ID existiert bereits.');
  if (error) throw new Error(error.message || 'Region konnte nicht erstellt werden.');

  return mapRegionRows([data])[0];
}

export async function updateFishRegion(regionId, patch) {
  const normalizedId = normalizeRegionId(regionId);
  if (!normalizedId) throw new Error('Region-ID fehlt.');

  const payload = {};
  if (patch?.label != null) {
    const label = asTrimmedString(patch.label);
    if (!label) throw new Error('Region-Name darf nicht leer sein.');
    payload.label = label;
  }
  if (patch?.is_active != null) payload.is_active = Boolean(patch.is_active);

  if (Object.keys(payload).length === 0) throw new Error('Keine Änderungen zum Speichern.');

  const { data, error } = await supabase
    .from('fish_regions')
    .update(payload)
    .eq('id', normalizedId)
    .select('id, label, is_active')
    .single();

  if (error) throw new Error(error.message || 'Region konnte nicht gespeichert werden.');
  return mapRegionRows([data])[0];
}

export async function deleteFishRegion(regionId) {
  const normalizedId = normalizeRegionId(regionId);
  if (!normalizedId) throw new Error('Region-ID fehlt.');

  const { error } = await supabase
    .from('fish_regions')
    .delete()
    .eq('id', normalizedId);

  if (error) throw new Error(error.message || 'Region konnte nicht gelöscht werden.');
}

export async function createFishRegionSpecies(input) {
  const regionId = normalizeRegionId(input?.region_id);
  const species = asTrimmedString(input?.species);
  if (!regionId) throw new Error('Region fehlt.');
  if (regionId === HOME_WATER_REGION_ID) {
    throw new Error('Vereinsgewässer-Fischarten werden clubspezifisch pro Verein gepflegt.');
  }
  if (!species) throw new Error('Fischart fehlt.');

  const payload = {
    region_id: regionId,
    species,
    is_active: input?.is_active !== false,
  };

  const { data, error } = await supabase
    .from('fish_region_species')
    .insert(payload)
    .select('id, region_id, species, is_active')
    .single();

  if (error?.code === '23505') throw new Error('Diese Fischart existiert in der Region bereits.');
  if (error) throw new Error(error.message || 'Fischart konnte nicht erstellt werden.');

  return mapSpeciesRows([data])[0];
}

export async function updateFishRegionSpecies(speciesId, patch) {
  const id = asTrimmedString(speciesId);
  if (!id) throw new Error('Eintrag-ID fehlt.');

  const payload = {};
  if (patch?.species != null) {
    const species = asTrimmedString(patch.species);
    if (!species) throw new Error('Fischart darf nicht leer sein.');
    payload.species = species;
  }
  if (patch?.is_active != null) payload.is_active = Boolean(patch.is_active);

  if (Object.keys(payload).length === 0) throw new Error('Keine Änderungen zum Speichern.');

  const { data, error } = await supabase
    .from('fish_region_species')
    .update(payload)
    .eq('id', id)
    .select('id, region_id, species, is_active')
    .single();

  if (error?.code === '23505') throw new Error('Diese Fischart existiert in der Region bereits.');
  if (error) throw new Error(error.message || 'Fischart konnte nicht gespeichert werden.');

  return mapSpeciesRows([data])[0];
}

export async function deleteFishRegionSpecies(speciesId) {
  const id = asTrimmedString(speciesId);
  if (!id) throw new Error('Eintrag-ID fehlt.');

  const { error } = await supabase
    .from('fish_region_species')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message || 'Fischart konnte nicht gelöscht werden.');
}
