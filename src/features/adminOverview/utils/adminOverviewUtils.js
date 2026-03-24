import { parseTimestamp } from '@/utils/dateUtils';
import { isHomeWaterEntry } from '@/utils/location';
import { PAGE_VIEW_YEAR_FILTER_ALL } from '@/features/adminOverview/pageViewUtils';

export const PAGE_VIEW_EXCLUDED_ANGLER = 'Nicol Schmidt';
export const ADMIN_OVERVIEW_FISH_SNAPSHOT_LIMIT = 2000;

export function isMissingPageViewRpcError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST202'
    || message.includes('could not find the function public.admin_page_view_years')
    || message.includes('could not find the function public.admin_page_view_monthly_counts');
}

export function buildMonthlyStatsFromDbCounts(dbRows, yearFilter) {
  if (!Array.isArray(dbRows)) return null;
  const rows = dbRows;

  const totalsByKey = new Map(
    rows.map((row) => {
      const year = Number(row?.year);
      const month = Number(row?.month);
      const total = Number(row?.total) || 0;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      return [key, total];
    }),
  );

  const selectedYear = yearFilter === PAGE_VIEW_YEAR_FILTER_ALL ? null : Number(yearFilter);

  if (Number.isInteger(selectedYear)) {
    const months = [];
    for (let month = 1; month <= 12; month += 1) {
      const key = `${selectedYear}-${String(month).padStart(2, '0')}`;
      months.push({
        key,
        label: new Date(selectedYear, month - 1, 1).toLocaleDateString('de-DE', {
          month: 'long',
          year: 'numeric',
        }),
        total: totalsByKey.get(key) || 0,
      });
    }
    return months;
  }

  if (rows.length === 0) return [];

  const keysAsc = [...totalsByKey.keys()].sort((a, b) => a.localeCompare(b));
  if (keysAsc.length === 0) return [];

  const [startYear, startMonth] = keysAsc[0].split('-').map(Number);
  const [endYear, endMonth] = keysAsc[keysAsc.length - 1].split('-').map(Number);
  const cursor = new Date(endYear, endMonth - 1, 1);
  const start = new Date(startYear, startMonth - 1, 1);
  const timeline = [];

  while (cursor >= start) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    timeline.push({
      key,
      label: new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      }),
      total: totalsByKey.get(key) || 0,
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return timeline;
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function parseBuildMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { build: null, commit: null };
  }
  const build = normalizeText(metadata.build || metadata.version || metadata.app_version) || null;
  const commit = normalizeText(metadata.commit || metadata.git_commit) || null;
  return { build, commit };
}

export function formatBuildLabel(buildInfo) {
  if (!buildInfo) return null;
  const parts = [];
  if (buildInfo.build) parts.push(buildInfo.build);
  if (buildInfo.commit) {
    const shortCommit = buildInfo.commit.slice(0, 7);
    parts.push(`#${shortCommit}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function buildRecentBlanks(rows, sinceDate) {
  return (rows || []).filter((row) => {
    if (row?.blank !== true) return false;
    const ts = parseTimestamp(row?.timestamp);
    return !!ts && ts > sinceDate;
  });
}

export function buildLatestCatch(rows) {
  return (rows || []).find((row) => row?.blank !== true) || null;
}

export function buildExternalCatches(rows, limit = 20, clubCoords = null) {
  const output = [];
  for (const row of rows || []) {
    if (!row || row?.lat == null || row?.lon == null) continue;
    if (row?.blank === true) continue;
    if (isHomeWaterEntry(row, { clubCoords })) continue;
    output.push(row);
    if (output.length >= limit) break;
  }
  return output;
}

export function getPageViewRange(pageViewYearFilter, snapshotIso) {
  if (pageViewYearFilter === PAGE_VIEW_YEAR_FILTER_ALL) {
    return {
      fromIso: null,
      toIso: snapshotIso,
      upperBoundOp: 'lte',
    };
  }

  const selectedYear = Number(pageViewYearFilter);
  if (!Number.isInteger(selectedYear)) {
    return {
      fromIso: null,
      toIso: snapshotIso,
      upperBoundOp: 'lte',
    };
  }

  return {
    fromIso: new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0, 0)).toISOString(),
    toIso: new Date(Date.UTC(selectedYear + 1, 0, 1, 0, 0, 0, 0)).toISOString(),
    upperBoundOp: 'lt',
  };
}
