function buildClubSelect({ hasIsActive, hasWeatherCoords, hasLogoUrl }) {
  const fields = ['id', 'slug', 'name', 'host'];
  if (hasIsActive) fields.push('is_active');
  if (hasWeatherCoords) fields.push('weather_lat', 'weather_lon');
  if (hasLogoUrl) fields.push('logo_url');
  fields.push('created_at');
  return fields.join(', ');
}

export const CLUB_SELECT_VARIANTS = Object.freeze([
  { hasIsActive: true, hasWeatherCoords: true, hasLogoUrl: true },
  { hasIsActive: true, hasWeatherCoords: true, hasLogoUrl: false },
  { hasIsActive: true, hasWeatherCoords: false, hasLogoUrl: true },
  { hasIsActive: true, hasWeatherCoords: false, hasLogoUrl: false },
  { hasIsActive: false, hasWeatherCoords: true, hasLogoUrl: true },
  { hasIsActive: false, hasWeatherCoords: true, hasLogoUrl: false },
  { hasIsActive: false, hasWeatherCoords: false, hasLogoUrl: true },
  { hasIsActive: false, hasWeatherCoords: false, hasLogoUrl: false },
].map((variant) => ({
  ...variant,
  select: buildClubSelect(variant),
})));

export function sanitizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export function isMissingFunctionError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42883' || message.includes('could not find the function');
}

export function isMissingClubIsActiveError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && message.includes('clubs.is_active');
}

export function isMissingClubWeatherCoordsError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && (message.includes('clubs.weather_lat') || message.includes('clubs.weather_lon'));
}

export function isMissingClubLogoUrlError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && message.includes('clubs.logo_url');
}

export function parseOptionalCoordinate(rawValue, { min, max, label }) {
  const raw = String(rawValue || '').trim().replace(',', '.');
  if (!raw) return { ok: true, value: null };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    return { ok: false, error: `${label} muss zwischen ${min} und ${max} liegen.` };
  }
  return { ok: true, value };
}

export function parseWeatherCoords({ latRaw, lonRaw }) {
  const latResult = parseOptionalCoordinate(latRaw, { min: -90, max: 90, label: 'Wetter-Breitengrad' });
  if (!latResult.ok) return latResult;
  const lonResult = parseOptionalCoordinate(lonRaw, { min: -180, max: 180, label: 'Wetter-Längengrad' });
  if (!lonResult.ok) return lonResult;

  const hasLat = latResult.value != null;
  const hasLon = lonResult.value != null;
  if (hasLat !== hasLon) {
    return { ok: false, error: 'Wetter-Breitengrad und Wetter-Längengrad bitte immer gemeinsam setzen.' };
  }
  return { ok: true, lat: latResult.value, lon: lonResult.value };
}

export function normalizeClubWithSchemaSupport(row, { hasIsActive, hasWeatherCoords, hasLogoUrl }) {
  return {
    ...row,
    is_active: hasIsActive ? row?.is_active : true,
    weather_lat: hasWeatherCoords ? row?.weather_lat : null,
    weather_lon: hasWeatherCoords ? row?.weather_lon : null,
    logo_url: hasLogoUrl ? row?.logo_url || null : null,
  };
}
