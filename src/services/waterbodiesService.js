import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { getDistanceMeters } from '@/utils/geo';

const WATERBODY_SELECT = [
  'id',
  'club_id',
  'name',
  'slug',
  'lat',
  'lon',
  'radius_m',
  'is_active',
  'sort_order',
  'description',
  'water_type',
  'weather_lat',
  'weather_lon',
  'created_at',
  'updated_at',
].join(', ');

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function toIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function asNullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function mapWaterbody(row) {
  return {
    id: row?.id ?? null,
    club_id: row?.club_id ?? null,
    name: String(row?.name || '').trim(),
    slug: asNullableString(row?.slug),
    lat: toNumberOrNull(row?.lat),
    lon: toNumberOrNull(row?.lon),
    radius_m: toIntegerOrNull(row?.radius_m) ?? 300,
    is_active: row?.is_active !== false,
    sort_order: toIntegerOrNull(row?.sort_order) ?? 0,
    description: asNullableString(row?.description),
    water_type: asNullableString(row?.water_type),
    weather_lat: toNumberOrNull(row?.weather_lat),
    weather_lon: toNumberOrNull(row?.weather_lon),
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function resolveClubId(clubId) {
  const resolved = clubId || getActiveClubId();
  if (!resolved) throw new Error('Kein aktiver Verein gefunden.');
  return resolved;
}

function normalizeCreatePayload(input) {
  const name = asNullableString(input?.name);
  if (!name) throw new Error('Name ist erforderlich.');

  const lat = toNumberOrNull(input?.lat);
  const lon = toNumberOrNull(input?.lon);
  if (lat == null || lon == null) {
    throw new Error('Breiten- und Längengrad sind erforderlich.');
  }

  const radius = toIntegerOrNull(input?.radius_m);
  if (radius != null && radius <= 0) {
    throw new Error('Radius muss größer als 0 sein.');
  }

  return {
    name,
    slug: asNullableString(input?.slug),
    lat,
    lon,
    radius_m: radius ?? 300,
    is_active: input?.is_active !== false,
    sort_order: toIntegerOrNull(input?.sort_order) ?? 0,
    description: asNullableString(input?.description),
    water_type: asNullableString(input?.water_type),
    weather_lat: toNumberOrNull(input?.weather_lat),
    weather_lon: toNumberOrNull(input?.weather_lon),
  };
}

function normalizeUpdatePayload(input = {}) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    const name = asNullableString(input?.name);
    if (!name) throw new Error('Name ist erforderlich.');
    payload.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'slug')) {
    payload.slug = asNullableString(input?.slug);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'lat')) {
    const lat = toNumberOrNull(input?.lat);
    if (lat == null) throw new Error('Breitengrad ist ungültig.');
    payload.lat = lat;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'lon')) {
    const lon = toNumberOrNull(input?.lon);
    if (lon == null) throw new Error('Längengrad ist ungültig.');
    payload.lon = lon;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'radius_m')) {
    const radius = toIntegerOrNull(input?.radius_m);
    if (radius == null || radius <= 0) throw new Error('Radius muss größer als 0 sein.');
    payload.radius_m = radius;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'is_active')) {
    payload.is_active = Boolean(input?.is_active);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'sort_order')) {
    const sortOrder = toIntegerOrNull(input?.sort_order);
    if (sortOrder == null) throw new Error('Sortierung muss eine ganze Zahl sein.');
    payload.sort_order = sortOrder;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'description')) {
    payload.description = asNullableString(input?.description);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'water_type')) {
    payload.water_type = asNullableString(input?.water_type);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'weather_lat')) {
    payload.weather_lat = toNumberOrNull(input?.weather_lat);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'weather_lon')) {
    payload.weather_lon = toNumberOrNull(input?.weather_lon);
  }

  return payload;
}

export async function listWaterbodiesByClub(clubId, { activeOnly = false } = {}) {
  const effectiveClubId = resolveClubId(clubId);
  let query = supabase
    .from('waterbodies')
    .select(WATERBODY_SELECT)
    .eq('club_id', effectiveClubId);

  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message || 'Gewässer konnten nicht geladen werden.');
  return (data || []).map(mapWaterbody);
}

export async function createWaterbody(input) {
  const clubId = resolveClubId(input?.club_id);
  const payload = normalizeCreatePayload(input);

  const { data, error } = await supabase
    .from('waterbodies')
    .insert({
      club_id: clubId,
      ...payload,
    })
    .select(WATERBODY_SELECT)
    .single();

  if (error) throw new Error(error.message || 'Gewässer konnte nicht erstellt werden.');
  return mapWaterbody(data);
}

export async function updateWaterbody(id, patch) {
  if (!id) throw new Error('Gewässer-ID fehlt.');
  const payload = normalizeUpdatePayload(patch);
  if (Object.keys(payload).length === 0) throw new Error('Keine Änderungen übergeben.');

  const clubId = resolveClubId(patch?.club_id);
  const { data, error } = await supabase
    .from('waterbodies')
    .update(payload)
    .eq('id', id)
    .eq('club_id', clubId)
    .select(WATERBODY_SELECT)
    .single();

  if (error) throw new Error(error.message || 'Gewässer konnte nicht gespeichert werden.');
  return mapWaterbody(data);
}

export async function deactivateWaterbody(id, options = {}) {
  if (!id) throw new Error('Gewässer-ID fehlt.');
  return updateWaterbody(id, {
    club_id: options.club_id,
    is_active: false,
  });
}

export function getNearestMatchingWaterbody({ waterbodies, lat, lon }) {
  const userLat = toNumberOrNull(lat);
  const userLon = toNumberOrNull(lon);
  if (userLat == null || userLon == null) return null;
  if (!Array.isArray(waterbodies) || waterbodies.length === 0) return null;

  let best = null;
  for (const item of waterbodies) {
    if (!item || item.is_active === false) continue;
    const centerLat = toNumberOrNull(item.lat);
    const centerLon = toNumberOrNull(item.lon);
    if (centerLat == null || centerLon == null) continue;

    const radius = toIntegerOrNull(item.radius_m) ?? 300;
    if (radius <= 0) continue;

    const distance = getDistanceMeters(userLat, userLon, centerLat, centerLon);
    if (distance > radius) continue;
    if (!best || distance < best.distance_m) {
      best = {
        waterbody: mapWaterbody(item),
        distance_m: distance,
      };
    }
  }

  return best;
}

export { WATERBODY_SELECT };
