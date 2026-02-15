import { parseTimestamp } from '@/utils/dateUtils';

export const PAGE_VIEW_LIMIT = 5000;
export const PAGE_VIEW_PAGE_SIZE = 1000;
export const EXCLUDED_PAGE_VIEW_ANGLERS = new Set(['nicol schmidt']);

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
    const key = row.path || '—';
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

export function buildPageViewAnglersByPath(filteredRows) {
  const map = new Map();
  filteredRows.forEach((row) => {
    const key = row?.path || '—';
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

export function buildPageViewMonthlyStats(filteredRows, pageViewYearStart) {
  const year = pageViewYearStart.getFullYear();
  const months = [];
  for (let month = 0; month < 12; month += 1) {
    const bucketDate = new Date(year, month, 1);
    months.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: bucketDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
      total: 0,
    });
  }
  const monthMap = new Map(months.map((entry) => [entry.key, entry]));
  filteredRows.forEach((row) => {
    const createdAt = parseTimestamp(row?.created_at);
    if (!createdAt) return;
    if (createdAt.getFullYear() !== year) return;
    const key = `${year}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthMap.get(key);
    if (bucket) bucket.total += 1;
  });
  return months.filter((entry) => entry.total > 0);
}

export function buildPageViewTopAnglers(filteredRows, latestAppActivityByName) {
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

  const merged = [...stats.values()].map((entry) => {
    const key = normalizeName(entry.name);
    const latestAppTs = parseTimestamp(latestAppActivityByName?.[key]);
    if (latestAppTs && (!entry.lastSeen || latestAppTs > entry.lastSeen)) {
      return { ...entry, lastSeen: latestAppTs };
    }
    return entry;
  });

  return merged
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const timeDiff = (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0);
      if (timeDiff !== 0) return timeDiff;
      return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
    })
    .slice(0, 20);
}

export function buildPageViewLastEvents({
  filteredRows,
  pageViewTopAnglers,
  labelForPath,
  currentBuildLabel,
  pageViewLastLimit,
}) {
  const latestPageByAngler = new Map();
  filteredRows.forEach((row) => {
    const rawName = typeof row?.angler === 'string' ? row.angler.trim() : '';
    if (!rawName) return;
    const key = normalizeName(rawName);
    if (!key) return;
    const rowTs = parseTimestamp(row?.created_at);
    if (!rowTs) return;
    const prev = latestPageByAngler.get(key);
    const prevTs = parseTimestamp(prev?.created_at);
    if (!prevTs || rowTs > prevTs) {
      latestPageByAngler.set(key, row);
    }
  });

  const events = pageViewTopAnglers.map((entry, idx) => {
    const key = normalizeName(entry.name);
    const pageRow = latestPageByAngler.get(key);
    const metadataObj = pageRow?.metadata && typeof pageRow.metadata === 'object'
      ? pageRow.metadata
      : null;
    const build = metadataObj?.build || metadataObj?.version || null;
    const createdAt = parseTimestamp(entry.lastSeen);
    return {
      kind: 'top_activity',
      key: `top-${key || idx}-${idx}`,
      angler: entry.name,
      label: pageRow?.path ? labelForPath(pageRow.path) : 'Seite unbekannt',
      path: pageRow?.path || null,
      created_at: createdAt ? createdAt.toISOString() : null,
      matchesCurrentBuild: (() => {
        const trimmed = build ? String(build).trim() : '';
        return Boolean(trimmed) && Boolean(currentBuildLabel) && trimmed === currentBuildLabel;
      })(),
    };
  });

  return events
    .sort(
      (a, b) =>
        (parseTimestamp(b?.created_at)?.getTime() || 0) -
        (parseTimestamp(a?.created_at)?.getTime() || 0)
    )
    .slice(0, pageViewLastLimit);
}
