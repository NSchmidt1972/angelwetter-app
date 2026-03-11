// src/regulations/ferkensbruch.js

// Mindestmaße (cm)
export const MIN_SIZES = {
  Aal: 50,
  Barsch: 18,
  Hecht: 60,
  Karpfen: 35,
  Rotauge: 18,
  Rotfeder: 18,
  Schleie: 30,
  Zander: 50,
};

// Schonzeiten (inclusive Grenzen)
// Format: { start: "MM-DD", end: "MM-DD" }
export const CLOSED_SEASONS = {
  Hecht: { start: "02-15", end: "05-31" },
  Zander: { start: "02-15", end: "05-31" },
};

function resolveSpeciesKey(species) {
  const name = String(species ?? "").trim();
  if (!name) return null;

  const directMatch = Object.prototype.hasOwnProperty.call(MIN_SIZES, name)
    || Object.prototype.hasOwnProperty.call(CLOSED_SEASONS, name);
  if (directMatch) return name;

  const keys = new Set([
    ...Object.keys(MIN_SIZES || {}),
    ...Object.keys(CLOSED_SEASONS || {}),
  ]);

  for (const key of keys) {
    if (key.localeCompare(name, "de", { sensitivity: "base" }) === 0) {
      return key;
    }
  }

  return name;
}

function parseMonthDay(value) {
  const match = /^(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
}

function isDateWithinSeason(date, season) {
  if (!season?.start || !season?.end) return false;

  const startParts = parseMonthDay(season.start);
  const endParts = parseMonthDay(season.end);
  if (!startParts || !endParts) return false;

  const year = date.getFullYear();
  const start = new Date(year, startParts.month - 1, startParts.day, 0, 0, 0, 0);
  const end = new Date(year, endParts.month - 1, endParts.day, 23, 59, 59, 999);

  // Falls ein Zeitraum über den Jahreswechsel läuft (z. B. Nov -> Feb), gilt OR-Logik.
  if (start <= end) return date >= start && date <= end;
  return date >= start || date <= end;
}

export function getClosedSeasonForFish(fish) {
  const species = resolveSpeciesKey(fish);
  if (!species) return null;

  const season = CLOSED_SEASONS[species];
  if (!season) return null;

  return { species, ...season };
}

export function isFishInClosedSeason(fish, date = new Date()) {
  const season = getClosedSeasonForFish(fish);
  if (!season) return false;
  return isDateWithinSeason(date, season);
}

// Prüfen, ob Fisch erlaubt ist (true = erlaubt, false = verboten)
export function isCatchAllowed(fish, sizeCm, date = new Date()) {
  const resolvedFish = resolveSpeciesKey(fish);

  // 1) Mindestmaß
  const minSize = MIN_SIZES[resolvedFish];
  if (minSize && sizeCm < minSize) {
    return { allowed: false, reason: `Mindestmaß für ${resolvedFish} ist ${minSize} cm.` };
  }

  // 2) Schonzeit
  const closed = getClosedSeasonForFish(resolvedFish);
  if (closed && isDateWithinSeason(date, closed)) {
    return { allowed: false, reason: `${closed.species} hat Schonzeit (${closed.start} – ${closed.end}).` };
  }

  return { allowed: true };
}
