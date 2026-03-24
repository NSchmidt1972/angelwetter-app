import { formatDateTime, parseTimestamp } from '@/utils/dateUtils';

export const PAGE_TITLE = 'Superadmin Übersicht';

export const CLUB_STATUS_FILTER = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PREPARATION: 'preparation',
});

export const CLUB_STATUS_OPTIONS = Object.freeze([
  { key: CLUB_STATUS_FILTER.ACTIVE, label: 'Aktiv' },
  { key: CLUB_STATUS_FILTER.INACTIVE, label: 'Nicht aktiv' },
  { key: CLUB_STATUS_FILTER.PREPARATION, label: 'In Vorbereitung' },
]);

export function getClubStatus(club, { memberCount, fishCount }) {
  const isActive = club?.is_active !== false;
  if (isActive) return CLUB_STATUS_FILTER.ACTIVE;
  const hasExistingData = Number(memberCount || 0) > 0 || Number(fishCount || 0) > 0;
  return hasExistingData ? CLUB_STATUS_FILTER.INACTIVE : CLUB_STATUS_FILTER.PREPARATION;
}

export function getClubStatusBadgeClasses(status) {
  if (status === CLUB_STATUS_FILTER.ACTIVE) {
    return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === CLUB_STATUS_FILTER.INACTIVE) {
    return 'border border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border border-amber-200 bg-amber-50 text-amber-800';
}

export function isMissingWeatherProxyMetricsTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('weather_proxy_metrics_daily');
}

export function toNonNegativeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

export function formatNumber(value, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed.toFixed(digits);
}

export function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatLogTimestamp(value) {
  return value ? formatDateTime(value) : '—';
}

const BERLIN_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toBerlinDayKey(value) {
  const parsed = parseTimestamp(value);
  if (!parsed) return null;

  const parts = BERLIN_DAY_FORMATTER.formatToParts(parsed).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function updateLatestDayBucketByClub(bucketByClub, clubId, dayKey, entry) {
  const current = bucketByClub[clubId];
  if (!current || dayKey > current.dayKey) {
    bucketByClub[clubId] = {
      dayKey,
      entries: [entry],
    };
    return;
  }
  if (dayKey === current.dayKey) {
    current.entries.push(entry);
  }
}

function sortByTimestampDesc(rows) {
  return [...rows].sort(
    (a, b) => (parseTimestamp(b?.timestamp)?.getTime() || 0) - (parseTimestamp(a?.timestamp)?.getTime() || 0),
  );
}

export function buildLatestClubActivityByClub(fishes) {
  const latestCatchDayByClub = {};
  const latestBlankDayByClub = {};
  const latestTakenDayByClub = {};

  (fishes || []).forEach((fish) => {
    const clubId = fish?.club_id;
    if (!clubId) return;

    const timestamp = parseTimestamp(fish?.timestamp);
    if (!timestamp) return;

    const dayKey = toBerlinDayKey(timestamp);
    if (!dayKey) return;

    const anglerName = String(fish?.angler || '').trim() || 'Unbekannt';
    const fishName = String(fish?.fish || '').trim() || 'Unbekannt';
    const baseEntry = {
      timestamp: timestamp.toISOString(),
      angler: anglerName,
      fish: fishName,
    };

    if (fish?.blank === true) {
      updateLatestDayBucketByClub(latestBlankDayByClub, clubId, dayKey, {
        timestamp: baseEntry.timestamp,
        angler: baseEntry.angler,
      });
    } else {
      updateLatestDayBucketByClub(latestCatchDayByClub, clubId, dayKey, baseEntry);
    }

    if (fish?.taken === true) {
      updateLatestDayBucketByClub(latestTakenDayByClub, clubId, dayKey, baseEntry);
    }
  });

  const clubIds = new Set([
    ...Object.keys(latestCatchDayByClub),
    ...Object.keys(latestBlankDayByClub),
    ...Object.keys(latestTakenDayByClub),
  ]);

  const output = {};
  clubIds.forEach((clubId) => {
    output[clubId] = {
      latestCatchDay: latestCatchDayByClub[clubId]
        ? {
          dayKey: latestCatchDayByClub[clubId].dayKey,
          entries: sortByTimestampDesc(latestCatchDayByClub[clubId].entries),
        }
        : null,
      latestBlankDay: latestBlankDayByClub[clubId]
        ? {
          dayKey: latestBlankDayByClub[clubId].dayKey,
          entries: sortByTimestampDesc(latestBlankDayByClub[clubId].entries),
        }
        : null,
      latestTakenDay: latestTakenDayByClub[clubId]
        ? {
          dayKey: latestTakenDayByClub[clubId].dayKey,
          entries: sortByTimestampDesc(latestTakenDayByClub[clubId].entries),
        }
        : null,
    };
  });

  return output;
}

export function formatDayKey(dayKey) {
  const [year, month, day] = String(dayKey || '').split('-').map(Number);
  if (!year || !month || !day) return '—';
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

export function buildOverviewStats(memberships, fishes, weatherRequestRows) {
  const memberCount = (memberships || []).reduce((acc, membership) => {
    const clubId = membership.club_id;
    acc[clubId] = (acc[clubId] || 0) + 1;
    return acc;
  }, {});

  const activeMemberCount = (memberships || []).reduce((acc, membership) => {
    if (!membership.is_active) return acc;
    const clubId = membership.club_id;
    acc[clubId] = (acc[clubId] || 0) + 1;
    return acc;
  }, {});

  const fishCount = (fishes || []).reduce((acc, fish) => {
    const clubId = fish.club_id;
    acc[clubId] = (acc[clubId] || 0) + 1;
    return acc;
  }, {});

  const totalRequests = (weatherRequestRows || []).reduce(
    (sum, row) => sum + toNonNegativeNumber(row?.openweather_call_count),
    0,
  );

  const requestCount = (weatherRequestRows || []).reduce((acc, row) => {
    const clubId = row?.club_id;
    if (!clubId) return acc;
    acc[clubId] = (acc[clubId] || 0) + toNonNegativeNumber(row?.openweather_call_count);
    return acc;
  }, {});

  return {
    memberCount,
    activeMemberCount,
    fishCount,
    requestCount,
    totalMembers: (memberships || []).length,
    totalFishes: (fishes || []).length,
    totalRequests,
  };
}

export function buildStatusCounts(clubs, stats) {
  const counts = {
    [CLUB_STATUS_FILTER.ACTIVE]: 0,
    [CLUB_STATUS_FILTER.INACTIVE]: 0,
    [CLUB_STATUS_FILTER.PREPARATION]: 0,
  };

  (clubs || []).forEach((club) => {
    const clubId = club.id;
    const status = getClubStatus(club, {
      memberCount: stats.memberCount[clubId] || 0,
      fishCount: stats.fishCount[clubId] || 0,
    });
    counts[status] += 1;
  });

  return counts;
}

export function filterClubsByStatus(clubs, stats, clubFilter) {
  return (clubs || []).filter((club) => {
    const clubId = club.id;
    const status = getClubStatus(club, {
      memberCount: stats.memberCount[clubId] || 0,
      fishCount: stats.fishCount[clubId] || 0,
    });
    return status === clubFilter;
  });
}
