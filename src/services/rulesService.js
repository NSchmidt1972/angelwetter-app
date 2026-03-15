// src/services/rulesService.js
import { MIN_SIZES, CLOSED_SEASONS, isCatchAllowed } from "../rules/clubRules";

/**
 * Baut eine normalisierte Regelliste aus den hinterlegten Vereinsregeln.
 * Rückgabe-Shape ist kompatibel zu früheren Beispielen:
 * { species, min_size_cm, season_start, season_end, protected, notes, water_body }
 */
export async function fetchRules() {
  const speciesSet = new Set([
    ...Object.keys(MIN_SIZES || {}),
    ...Object.keys(CLOSED_SEASONS || {})
  ]);

  const rules = Array.from(speciesSet).map((species) => {
    const min = MIN_SIZES[species] ?? null;
    const season = CLOSED_SEASONS[species] || null;

    return {
      species,
      min_size_cm: min,
      // Wir lassen bewusst YYYY weg und zeigen MM-DD Strings, das reicht für die Anzeige
      season_start: season ? season.start : null, // "MM-DD" oder null
      season_end: season ? season.end : null,     // "MM-DD" oder null
      protected: false,
      notes: season
        ? "Während der Schonzeit sind toter Köderfisch und alle Kunstköder verboten."
        : "",
      water_body: "Vereinsgewässer",
    };
  });

  // Sortiert nach Fischname
  rules.sort((a, b) => a.species.localeCompare(b.species, "de"));
  return rules;
}

/**
 * Prüft Fang gegen Regeln. Nutzt deine isCatchAllowed-Logik und liefert ein einheitliches Ergebnis.
 * params: { species, sizeCm, dateISO }
 */
export function evaluateCatchAgainstRules({ species, sizeCm, dateISO }) {
  const date = dateISO ? new Date(dateISO) : new Date();

  const result = isCatchAllowed(species, Number(sizeCm), date);
  const messages = [];
  if (!result.allowed && result.reason) messages.push(result.reason);

  // Für UI: aktuelle Regel zusammensetzen
  const rule = {
    species,
    min_size_cm: MIN_SIZES[species] ?? null,
    season_start: CLOSED_SEASONS[species]?.start ?? null,
    season_end: CLOSED_SEASONS[species]?.end ?? null,
    protected: false,
    notes: CLOSED_SEASONS[species]
      ? "Während der Schonzeit sind toter Köderfisch und alle Kunstköder verboten."
      : "",
    water_body: "Vereinsgewässer",
  };

  return {
    allowed: !!result.allowed,
    messages,
    rule,
  };
}
