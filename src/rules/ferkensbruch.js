// src/regulations/ferkensbruch.js

// Mindestmaße (cm)
export const MIN_SIZES = {
  Aal: 50,
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

// Prüfen, ob Fisch erlaubt ist (true = erlaubt, false = verboten)
export function isCatchAllowed(fish, sizeCm, date = new Date()) {
  // 1) Mindestmaß
  const minSize = MIN_SIZES[fish];
  if (minSize && sizeCm < minSize) {
    return { allowed: false, reason: `Mindestmaß für ${fish} ist ${minSize} cm.` };
  }

  // 2) Schonzeit
  const closed = CLOSED_SEASONS[fish];
  if (closed) {
    const y = date.getFullYear();
    const start = new Date(`${y}-${closed.start}T00:00:00`);
    const end = new Date(`${y}-${closed.end}T23:59:59`);
    if (date >= start && date <= end) {
      return { allowed: false, reason: `${fish} hat Schonzeit (${closed.start} – ${closed.end}).` };
    }
  }

  return { allowed: true };
}
