import { parseTimestamp } from '@/utils/dateUtils';

export const PAGE_VIEW_RECENT_LIMIT = 5000;
export const PAGE_VIEW_PAGE_SIZE = 1000;
export const PAGE_VIEW_MAX_FETCH_PAGES = 1000;
export const EXCLUDED_PAGE_VIEW_ANGLERS = new Set(['nicol schmidt']);
export const PAGE_VIEW_YEAR_FILTER_ALL = 'all';

export function normalizePath(value) {
  if (!value) return '/';
  const pathOnly = value.split('?')[0].split('#')[0];
  const ensured = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  if (ensured.length > 1 && ensured.endsWith('/')) return ensured.slice(0, -1);
  return ensured || '/';
}

export function normalizeName(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

export function groupPageViews(rows) {
  const counts = new Map();

  rows.forEach((row) => {
    const key = normalizePath(row?.path || '/');
    const entry = counts.get(key) || {
      path: key,
      total: 0,
      uniqueAnglers: new Set(),
      lastSeen: null,
    };

    entry.total += 1;
    if (row.angler) entry.uniqueAnglers.add(row.angler);

    const createdAt = row.created_at ? new Date(row.created_at) : null;
    if (createdAt && (!entry.lastSeen || createdAt > entry.lastSeen)) {
      entry.lastSeen = createdAt;
    }

    counts.set(key, entry);
  });

  return [...counts.values()]
    .map((entry) => ({
      path: entry.path,
      total: entry.total,
      uniqueAnglers: entry.uniqueAnglers.size,
      lastSeen: entry.lastSeen,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0);
    });
}

export function filterPageViewRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.filter((row) => {
    const anglerKey = normalizeName(row?.angler);
    if (anglerKey && EXCLUDED_PAGE_VIEW_ANGLERS.has(anglerKey)) return false;
    return true;
  });
}

export function getPageViewAvailableYears(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const years = new Set();
  rows.forEach((row) => {
    const createdAt = parseTimestamp(row?.created_at);
    if (!createdAt) return;
    years.add(createdAt.getFullYear());
  });
  return [...years].sort((a, b) => b - a);
}

export function filterPageViewRowsByYear(rows, yearFilter) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (yearFilter === PAGE_VIEW_YEAR_FILTER_ALL) return rows;
  const selectedYear = Number(yearFilter);
  if (!Number.isInteger(selectedYear)) return rows;

  return rows.filter((row) => {
    const createdAt = parseTimestamp(row?.created_at);
    return Boolean(createdAt) && createdAt.getFullYear() === selectedYear;
  });
}

export function buildPageViewAnglersByPath(filteredRows) {
  const map = new Map();
  filteredRows.forEach((row) => {
    const key = normalizePath(row?.path || '/');
    const name = typeof row?.angler === 'string' ? row.angler.trim() : '';
    if (!name) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(name);
  });
  return map;
}

export function getUniqueAnglersForPath(pageViewAnglersByPath, path) {
  const set = pageViewAnglersByPath.get(path);
  if (!set) return [];
  return [...set].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
}

export function buildPageViewMonthlyStats(filteredRows, yearFilter) {
  if (!Array.isArray(filteredRows) || filteredRows.length === 0) return [];

  if (yearFilter === PAGE_VIEW_YEAR_FILTER_ALL) {
    const monthMap = new Map();
    let minMonthStart = null;
    let maxMonthStart = null;

    filteredRows.forEach((row) => {
      const createdAt = parseTimestamp(row?.created_at);
      if (!createdAt) return;
      const year = createdAt.getFullYear();
      const month = createdAt.getMonth();
      const monthStart = new Date(year, month, 1);
      if (!minMonthStart || monthStart < minMonthStart) minMonthStart = monthStart;
      if (!maxMonthStart || monthStart > maxMonthStart) maxMonthStart = monthStart;
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const bucket = monthMap.get(key) || {
        key,
        label: new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
        total: 0,
      };
      bucket.total += 1;
      monthMap.set(key, bucket);
    });

    if (!minMonthStart || !maxMonthStart) return [];

    const timeline = [];
    const cursor = new Date(maxMonthStart.getFullYear(), maxMonthStart.getMonth(), 1);
    while (cursor >= minMonthStart) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key);
      timeline.push(existing || {
        key,
        label: cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
        total: 0,
      });
      cursor.setMonth(cursor.getMonth() - 1);
    }

    return timeline;
  }

  const selectedYear = Number(yearFilter);
  if (!Number.isInteger(selectedYear)) return [];

  const months = [];
  for (let month = 0; month < 12; month += 1) {
    const bucketDate = new Date(selectedYear, month, 1);
    months.push({
      key: `${selectedYear}-${String(month + 1).padStart(2, '0')}`,
      label: bucketDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
      total: 0,
    });
  }
  const monthMap = new Map(months.map((entry) => [entry.key, entry]));
  filteredRows.forEach((row) => {
    const createdAt = parseTimestamp(row?.created_at);
    if (!createdAt) return;
    if (createdAt.getFullYear() !== selectedYear) return;
    const key = `${selectedYear}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthMap.get(key);
    if (bucket) bucket.total += 1;
  });
  return months;
}

export function buildPageViewTopAnglers(filteredRows) {
  const stats = new Map();

  filteredRows.forEach((row) => {
    const rawName = typeof row?.angler === 'string' ? row.angler.trim() : '';
    if (!rawName) return;
    const entry = stats.get(rawName) || { name: rawName, total: 0, lastSeen: null };
    entry.total += 1;

    const createdAt = row?.created_at ? new Date(row.created_at) : null;
    if (createdAt && (!entry.lastSeen || createdAt > entry.lastSeen)) {
      entry.lastSeen = createdAt;
    }

    stats.set(rawName, entry);
  });

  return [...stats.values()]
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const timeDiff = (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0);
      if (timeDiff !== 0) return timeDiff;
      return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
    })
    .slice(0, 20);
}
