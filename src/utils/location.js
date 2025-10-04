// Utility helpers for location-related checks in the app.

export const FERKENSBRUCH_LABEL = 'Ferkensbruch';
const FERKENSBRUCH_PATTERNS = [
  /^\s*$/,
  /^\s*lob+er+ich\s*$/i,
  /^\s*ferkens?bruch\s*$/i,
  /^\s*(null|undefined|-)\s*$/i,
];

export function isFerkensbruchLocation(value) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return true;
  if (FERKENSBRUCH_PATTERNS.some((re) => re.test(raw))) return true;
  const lower = raw.toLowerCase();
  return lower.includes('ferkensbruch');
}

export function formatLocationLabel(value) {
  const raw = (value ?? '').toString().trim();
  if (isFerkensbruchLocation(raw)) return FERKENSBRUCH_LABEL;
  return raw || 'Unbekannt';
}
