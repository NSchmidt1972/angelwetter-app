import { supabase } from '@/supabaseClient';
import { withTimeout } from '@/utils/async';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_TIMEOUT_LABEL = 'Club-Koordinaten timeout';
const CLUB_COORDS_CACHE_TTL_MS = 5 * 60 * 1000;

const clubCoordsCache = new Map();
const clubCoordsInFlight = new Map();

function toFiniteNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMissingClubCoordinateColumnsError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && (message.includes('clubs.weather_lat') || message.includes('clubs.weather_lon'));
}

function readCachedClubCoords(clubId) {
  const cached = clubCoordsCache.get(clubId);
  if (!cached) return { hit: false, coords: null };
  if (Date.now() - cached.fetchedAt > CLUB_COORDS_CACHE_TTL_MS) {
    clubCoordsCache.delete(clubId);
    return { hit: false, coords: null };
  }
  return { hit: true, coords: cached.coords };
}

function writeCachedClubCoords(clubId, coords) {
  clubCoordsCache.set(clubId, {
    coords,
    fetchedAt: Date.now(),
  });
}

export function parseClubCoordinates(row) {
  const lat = toFiniteNumber(row?.weather_lat);
  const lon = toFiniteNumber(row?.weather_lon);
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

export function clearClubCoordinatesCache(clubId = null) {
  if (clubId) {
    clubCoordsCache.delete(clubId);
    clubCoordsInFlight.delete(clubId);
    return;
  }
  clubCoordsCache.clear();
  clubCoordsInFlight.clear();
}

export async function fetchClubCoordinates(clubId, options = {}) {
  if (!clubId) return null;

  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    timeoutLabel = DEFAULT_TIMEOUT_LABEL,
    useCache = true,
  } = options;

  if (useCache) {
    const cached = readCachedClubCoords(clubId);
    if (cached.hit) return cached.coords;
  }

  if (clubCoordsInFlight.has(clubId)) {
    return clubCoordsInFlight.get(clubId);
  }

  const request = (async () => {
    const query = supabase
      .from('clubs')
      .select('weather_lat, weather_lon')
      .eq('id', clubId)
      .maybeSingle();

    const { data, error } = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? await withTimeout(query, timeoutMs, timeoutLabel)
      : await query;

    if (error) {
      if (isMissingClubCoordinateColumnsError(error)) return null;
      throw error;
    }

    return parseClubCoordinates(data);
  })()
    .then((coords) => {
      if (useCache) writeCachedClubCoords(clubId, coords);
      return coords;
    })
    .finally(() => {
      clubCoordsInFlight.delete(clubId);
    });

  clubCoordsInFlight.set(clubId, request);
  return request;
}
