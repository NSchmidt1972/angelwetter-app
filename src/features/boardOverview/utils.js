const rangeBucket = (key, label, min, max, ageLabel = '') => ({ key, label, min, max, ageLabel });

const SIZE_BUCKETS = {
  Karpfen: [
    rangeBucket('karpfen-under', '< 35 cm', null, 35, 'ca. 1-2 Jahre'),
    rangeBucket('karpfen-35-44', '35 - 44 cm', 35, 45, 'ca. 2-3 Jahre'),
    rangeBucket('karpfen-45-54', '45 - 54 cm', 45, 55, 'ca. 3-4 Jahre'),
    rangeBucket('karpfen-55-64', '55 - 64 cm', 55, 65, 'ca. 4-5 Jahre'),
    rangeBucket('karpfen-65-74', '65 - 74 cm', 65, 75, 'ca. 5-6 Jahre'),
    rangeBucket('karpfen-75-84', '75 - 84 cm', 75, 85, 'ca. 6-7 Jahre'),
    rangeBucket('karpfen-85-94', '85 - 94 cm', 85, 95, 'ca. 7-9 Jahre'),
    rangeBucket('karpfen-95plus', '>= 95 cm', 95, null, '9+ Jahre'),
  ],
  Hecht: [
    rangeBucket('hecht-under', '< 50 cm', null, 50, 'ca. 1 Jahr'),
    rangeBucket('hecht-50-59', '50 - 59 cm', 50, 60, 'ca. 2 Jahre'),
    rangeBucket('hecht-60-74', '60 - 74 cm', 60, 75, 'ca. 3-4 Jahre'),
    rangeBucket('hecht-75-89', '75 - 89 cm', 75, 90, 'ca. 5-6 Jahre'),
    rangeBucket('hecht-90-109', '90 - 109 cm', 90, 110, 'ca. 7-9 Jahre'),
    rangeBucket('hecht-110plus', '>= 110 cm', 110, null, '10+ Jahre'),
  ],
  Zander: [
    rangeBucket('zander-under', '< 40 cm', null, 40, '< 1 Jahr'),
    rangeBucket('zander-40-49', '40 - 49 cm', 40, 50, 'ca. 1-2 Jahre'),
    rangeBucket('zander-50-59', '50 - 59 cm', 50, 60, 'ca. 2-3 Jahre'),
    rangeBucket('zander-60-69', '60 - 69 cm', 60, 70, 'ca. 3-4 Jahre'),
    rangeBucket('zander-70-79', '70 - 79 cm', 70, 80, 'ca. 4-5 Jahre'),
    rangeBucket('zander-80plus', '>= 80 cm', 80, null, '5+ Jahre'),
  ],
  Barsch: [
    rangeBucket('barsch-under', '< 20 cm', null, 20, '< 1 Jahr'),
    rangeBucket('barsch-20-24', '20 - 24 cm', 20, 25, 'ca. 1 Jahr'),
    rangeBucket('barsch-25-29', '25 - 29 cm', 25, 30, 'ca. 2 Jahre'),
    rangeBucket('barsch-30-34', '30 - 34 cm', 30, 35, 'ca. 3 Jahre'),
    rangeBucket('barsch-35plus', '>= 35 cm', 35, null, '4+ Jahre'),
  ],
  Aal: [
    rangeBucket('aal-under', '< 50 cm', null, 50, '< 2 Jahre'),
    rangeBucket('aal-50-59', '50 - 59 cm', 50, 60, 'ca. 2-3 Jahre'),
    rangeBucket('aal-60-69', '60 - 69 cm', 60, 70, 'ca. 3-4 Jahre'),
    rangeBucket('aal-70-79', '70 - 79 cm', 70, 80, 'ca. 4-5 Jahre'),
    rangeBucket('aal-80plus', '>= 80 cm', 80, null, '5+ Jahre'),
  ],
  Rotauge: [
    rangeBucket('rotauge-under', '< 18 cm', null, 18, '< 1 Jahr'),
    rangeBucket('rotauge-18-24', '18 - 24 cm', 18, 25, 'ca. 1-2 Jahre'),
    rangeBucket('rotauge-25-29', '25 - 29 cm', 25, 30, 'ca. 2-3 Jahre'),
    rangeBucket('rotauge-30plus', '>= 30 cm', 30, null, '3+ Jahre'),
  ],
  Rotfeder: [
    rangeBucket('rotfeder-under', '< 18 cm', null, 18, '< 1 Jahr'),
    rangeBucket('rotfeder-18-24', '18 - 24 cm', 18, 25, 'ca. 1-2 Jahre'),
    rangeBucket('rotfeder-25-29', '25 - 29 cm', 25, 30, 'ca. 2-3 Jahre'),
    rangeBucket('rotfeder-30plus', '>= 30 cm', 30, null, '3+ Jahre'),
  ],
  Schleie: [
    rangeBucket('schleie-under', '< 30 cm', null, 30, '< 2 Jahre'),
    rangeBucket('schleie-30-39', '30 - 39 cm', 30, 40, 'ca. 2-3 Jahre'),
    rangeBucket('schleie-40-49', '40 - 49 cm', 40, 50, 'ca. 3-4 Jahre'),
    rangeBucket('schleie-50-59', '50 - 59 cm', 50, 60, 'ca. 5-6 Jahre'),
    rangeBucket('schleie-60plus', '>= 60 cm', 60, null, '6+ Jahre'),
  ],
  Brasse: [
    rangeBucket('brasse-under', '< 25 cm', null, 25, '< 2 Jahre'),
    rangeBucket('brasse-25-34', '25 - 34 cm', 25, 35, 'ca. 2-3 Jahre'),
    rangeBucket('brasse-35-44', '35 - 44 cm', 35, 45, 'ca. 3-4 Jahre'),
    rangeBucket('brasse-45-54', '45 - 54 cm', 45, 55, 'ca. 4-5 Jahre'),
    rangeBucket('brasse-55plus', '>= 55 cm', 55, null, '5+ Jahre'),
  ],
  Wels: [
    rangeBucket('wels-under', '< 50 cm', null, 50, '< 1 Jahr'),
    rangeBucket('wels-50-79', '50 - 79 cm', 50, 80, 'ca. 1-2 Jahre'),
    rangeBucket('wels-80-99', '80 - 99 cm', 80, 100, 'ca. 2-3 Jahre'),
    rangeBucket('wels-100-149', '100 - 149 cm', 100, 150, 'ca. 3-5 Jahre'),
    rangeBucket('wels-150-199', '150 - 199 cm', 150, 200, 'ca. 5-8 Jahre'),
    rangeBucket('wels-200plus', '>= 200 cm', 200, null, '8+ Jahre'),
  ],
};

SIZE_BUCKETS.default = [
  rangeBucket('default-under', '< 20 cm', null, 20, '< 1 Jahr'),
  rangeBucket('default-20-29', '20 - 29 cm', 20, 30, 'ca. 1-2 Jahre'),
  rangeBucket('default-30-39', '30 - 39 cm', 30, 40, 'ca. 2-3 Jahre'),
  rangeBucket('default-40-49', '40 - 49 cm', 40, 50, 'ca. 3-4 Jahre'),
  rangeBucket('default-50plus', '>= 50 cm', 50, null, '4+ Jahre'),
];

export function getBucketsForFish(fishName) {
  if (!fishName) return SIZE_BUCKETS.default;
  return SIZE_BUCKETS[fishName] || SIZE_BUCKETS.default;
}

export function parseSizeValue(value) {
  if (value == null) return null;
  const normalized = Number(String(value).replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : null;
}

export function buildSizeDistribution(entries = [], fishName = '') {
  const buckets = getBucketsForFish(fishName).map((bucket) => ({
    ...bucket,
    count: 0,
    takenCount: 0,
  }));
  let missingCount = 0;

  entries.forEach((entry) => {
    const numericSize = parseSizeValue(entry?.size);
    if (!Number.isFinite(numericSize)) {
      missingCount += 1;
      return;
    }

    const targetBucket = buckets.find((bucket) => {
      const meetsMin = bucket.min == null || numericSize >= bucket.min;
      const meetsMax = bucket.max == null || numericSize < bucket.max;
      return meetsMin && meetsMax;
    });

    const bucketToUpdate = targetBucket || (buckets.length > 0 ? buckets[buckets.length - 1] : null);
    if (bucketToUpdate) {
      bucketToUpdate.count += 1;
      if (entry?.taken === true) {
        bucketToUpdate.takenCount += 1;
      }
    }
  });

  const measuredCount = entries.length - missingCount;

  return {
    buckets,
    missingCount,
    measuredCount,
  };
}

export function normalizeRoleValue(role) {
  if (!role) return 'mitglied';
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'mitglied') return 'mitglied';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'vorstand') return 'vorstand';
  if (normalized === 'gast') return 'gast';
  if (normalized === 'tester') return 'tester';
  if (normalized === 'inactive' || normalized === 'inaktiv') return 'inactive';
  return 'mitglied';
}

export function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.warn('formatDate failed', error);
    return '—';
  }
}

export function formatNumber(value) {
  try {
    return new Intl.NumberFormat('de-DE').format(value ?? 0);
  } catch (error) {
    console.warn('formatNumber failed', error);
    return String(value ?? 0);
  }
}

export function formatPercent(value) {
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value ?? 0);
  } catch (error) {
    console.warn('formatPercent failed', error);
    const fallback = Number.isFinite(value) ? (value * 100).toFixed(0) : '0';
    return `${fallback}%`;
  }
}

export function formatDecimal(value, fractionDigits = 1) {
  try {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value ?? 0);
  } catch (error) {
    console.warn('formatDecimal failed', error);
    return Number.isFinite(value) ? value.toFixed(fractionDigits) : '0';
  }
}

function getLastMonths(count = 12) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      date,
      label: date.toLocaleDateString('de-DE', { month: 'short' }),
    });
  }
  return months;
}

function getMonthsForYear(year) {
  if (!Number.isFinite(year)) return getLastMonths(12);
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(year, i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      date,
      label: date.toLocaleDateString('de-DE', { month: 'short' }),
    });
  }
  return months;
}

export function getMonthsForAllYears() {
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(2000, i, 1);
    const key = `all-${String(i + 1).padStart(2, '0')}`;
    months.push({
      key,
      date,
      label: date.toLocaleDateString('de-DE', { month: 'short' }),
    });
  }
  return months;
}

export function getMonthsForSelection(selection) {
  if (selection === 'all') return getMonthsForAllYears();
  if (!Number.isFinite(selection)) return getLastMonths(12);
  return getMonthsForYear(selection);
}

export const ACTIVITY_RANGE_OPTIONS = [
  { value: 'current-week', label: 'Aktuelle Woche' },
  { value: 'current-month', label: 'Aktueller Monat' },
  { value: '30d', label: 'Letzte 30 Tage' },
  { value: '90d', label: 'Letzte 90 Tage' },
  { value: '180d', label: 'Letzte 180 Tage' },
];

export function filterEntriesByRange(entries = [], range, referenceTime = Date.now()) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const now = new Date(referenceTime);
  let start = null;
  let end = null;

  switch (range) {
    case 'current-week': {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1 - day) * 24 * 60 * 60 * 1000;
      start = new Date(now.getTime() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'current-month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '180d':
      start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case 'last-year': {
      const lastYear = now.getFullYear() - 1;
      start = new Date(lastYear, 0, 1);
      end = new Date(now.getFullYear(), 0, 1);
      break;
    }
    case 'current-year':
    default:
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return entries.filter((entry) => {
    const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
    if (!ts || Number.isNaN(ts.getTime())) return false;
    if (start && ts < start) return false;
    if (end && ts >= end) return false;
    return true;
  });
}

const FISH_COLOR_CLASSES = [
  'bg-blue-500 dark:bg-blue-400',
  'bg-emerald-500 dark:bg-emerald-400',
  'bg-amber-500 dark:bg-amber-400',
  'bg-indigo-500 dark:bg-indigo-400',
  'bg-rose-500 dark:bg-rose-400',
  'bg-cyan-500 dark:bg-cyan-400',
  'bg-lime-500 dark:bg-lime-400',
  'bg-fuchsia-500 dark:bg-fuchsia-400',
  'bg-orange-500 dark:bg-orange-400',
];

export function getColorStyleByIndex(index) {
  if (index == null || Number.isNaN(index)) {
    return { className: FISH_COLOR_CLASSES[0], style: undefined };
  }
  if (index < FISH_COLOR_CLASSES.length) {
    return { className: FISH_COLOR_CLASSES[index], style: undefined };
  }
  const hue = (index * 47) % 360;
  return { className: '', style: { backgroundColor: `hsl(${hue}, 70%, 55%)` } };
}
