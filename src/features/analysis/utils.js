export function windDirection(deg) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function getMoonDescription(phase) {
  if (phase === 0 || phase === 1) return '🌑 Neumond';
  if (phase > 0 && phase < 0.25) return '🌒 Zunehmender Sichelmond';
  if (phase === 0.25) return '🌓 Erstes Viertel';
  if (phase > 0.25 && phase < 0.5) return '🌔 Zunehmender Dreiviertelmond';
  if (phase === 0.5) return '🌕 Vollmond';
  if (phase > 0.5 && phase < 0.75) return '🌖 Abnehmender Dreiviertelmond';
  if (phase === 0.75) return '🌗 Letztes Viertel';
  if (phase > 0.75 && phase < 1) return '🌘 Abnehmender Sichelmond';
  return '❓ Unbekannt';
}

export const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export const ANALYSIS_YEAR_FILTER_ALL = 'all';

export function findMatchingKey(value, stats) {
  if (value == null || !stats) return null;
  return (
    Object.keys(stats).find((label) => {
      const cleaned = label.replace(/[^<>=0-9–-]/g, '');
      const rangeMatch = label.match(/(-?\d+)\s*[–-]\s*(-?\d+)/);
      if (rangeMatch) {
        const [, min, max] = rangeMatch;
        return value >= parseInt(min, 10) && value <= parseInt(max, 10);
      }
      if (/^<\s*\d+/.test(cleaned)) {
        const limit = parseInt(cleaned.replace('<', ''), 10);
        return value < limit;
      }
      if (/^(≥|>=)\s*\d+/.test(cleaned)) {
        const limit = parseInt(cleaned.replace(/[^\d]/g, ''), 10);
        return value >= limit;
      }
      const numMatch = label.match(/\d+/);
      if (numMatch) {
        const target = parseInt(numMatch[0], 10);
        return Math.abs(target - value) <= 1;
      }
      return false;
    }) ?? null
  );
}

export function buildDescIconMap(weatherValidFishes) {
  const descIconMap = {};
  for (const fish of weatherValidFishes) {
    const desc = fish.weather?.description?.toLowerCase().trim();
    const icon = fish.weather?.icon;
    if (desc && icon && !descIconMap[desc]) {
      descIconMap[desc] = icon;
    }
  }
  return descIconMap;
}
