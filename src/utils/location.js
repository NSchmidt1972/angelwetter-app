// Utility helpers for location-related checks in the app.
import { getDistanceKm } from '@/utils/geo';

export const HOME_WATER_LABEL = 'Vereinsgewässer';
export const FERKENSBRUCH_LABEL = HOME_WATER_LABEL;
export const HOME_WATER_RADIUS_KM = 3.5;
const HOME_WATER_PATTERNS = [
  /^\s*$/,
  /^\s*lob+er+ich\s*$/i,
  /^\s*ferkens?bruch\s*$/i,
  /^\s*vereinsgew(ae|ä)sser\s*$/i,
  /^\s*vereinssee\s*$/i,
  /^\s*(null|undefined|-)\s*$/i,
];

export function isFerkensbruchLocation(value) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return true;
  if (HOME_WATER_PATTERNS.some((re) => re.test(raw))) return true;
  const lower = raw.toLowerCase();
  return lower.includes('ferkensbruch');
}

function toFiniteNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isNearClubHomeWater(entry, clubCoords, radiusKm = HOME_WATER_RADIUS_KM) {
  const lat = toFiniteNumber(entry?.lat);
  const lon = toFiniteNumber(entry?.lon);
  const centerLat = toFiniteNumber(clubCoords?.lat);
  const centerLon = toFiniteNumber(clubCoords?.lon);
  if (lat == null || lon == null || centerLat == null || centerLon == null) return false;
  return getDistanceKm(lat, lon, centerLat, centerLon) <= radiusKm;
}

export function isHomeWaterEntry(entry, { clubCoords = null, radiusKm = HOME_WATER_RADIUS_KM } = {}) {
  if (isNearClubHomeWater(entry, clubCoords, radiusKm)) return true;
  return isFerkensbruchLocation(entry?.location_name);
}

export function formatLocationLabel(value) {
  const raw = (value ?? '').toString().trim();
  if (isFerkensbruchLocation(raw)) return HOME_WATER_LABEL;
  return raw || 'Unbekannt';
}
