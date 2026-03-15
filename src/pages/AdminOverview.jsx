import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { formatDateOnly, formatDateTime, parseTimestamp } from '@/utils/dateUtils';
import { isHomeWaterEntry } from '@/utils/location';
import { navItemsFor } from '@/config/navItems';
import { Card } from '@/components/ui';
import PageViewsSection from '@/features/adminOverview/components/PageViewsSection';
import ActiveUsersSection from '@/features/adminOverview/components/ActiveUsersSection';
import ExternalCatchesSection from '@/features/adminOverview/components/ExternalCatchesSection';
import LatestCatchSection from '@/features/adminOverview/components/LatestCatchSection';
import OneSignalDebugSection from '@/features/adminOverview/components/OneSignalDebugSection';
import PushSubscribersSection from '@/features/adminOverview/components/PushSubscribersSection';
import RecentBlanksSection from '@/features/adminOverview/components/RecentBlanksSection';
import RegisteredUsersSection from '@/features/adminOverview/components/RegisteredUsersSection';
import SensorLogsSection from '@/features/adminOverview/components/SensorLogsSection';
import TakenCatchesSection from '@/features/adminOverview/components/TakenCatchesSection';
import {
  PAGE_VIEW_MAX_FETCH_PAGES,
  PAGE_VIEW_PAGE_SIZE,
  PAGE_VIEW_RECENT_LIMIT,
  PAGE_VIEW_YEAR_FILTER_ALL,
  buildPageViewAnglersByPath,
  buildPageViewMonthlyStats,
  buildPageViewTopAnglers,
  filterPageViewRows,
  filterPageViewRowsByYear,
  getPageViewAvailableYears,
  getUniqueAnglersForPath,
  groupPageViews,
  normalizeName,
  normalizePath,
} from '@/features/adminOverview/pageViewUtils';

const PAGE_VIEW_EXCLUDED_ANGLER = null;

function isMissingPageViewRpcError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST202'
    || message.includes('could not find the function public.admin_page_view_years')
    || message.includes('could not find the function public.admin_page_view_monthly_counts');
}

function buildMonthlyStatsFromDbCounts(dbRows, yearFilter) {
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
        label: new Date(selectedYear, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
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
      label: new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
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

function parseBuildMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { build: null, commit: null };
  }
  const build = normalizeText(metadata.build || metadata.version || metadata.app_version) || null;
  const commit = normalizeText(metadata.commit || metadata.git_commit) || null;
  return { build, commit };
}

function formatBuildLabel(buildInfo) {
  if (!buildInfo) return null;
  const parts = [];
  if (buildInfo.build) parts.push(buildInfo.build);
  if (buildInfo.commit) {
    const shortCommit = buildInfo.commit.slice(0, 7);
    parts.push(`#${shortCommit}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

const ADMIN_OVERVIEW_FISH_SNAPSHOT_LIMIT = 2000;

function buildRecentBlanks(rows, sinceDate) {
  return (rows || []).filter((row) => {
    if (row?.blank !== true) return false;
    const ts = parseTimestamp(row?.timestamp);
    return !!ts && ts > sinceDate;
  });
}

function buildLatestCatch(rows) {
  return (rows || []).find((row) => row?.blank !== true) || null;
}

function parseClubCoords(row) {
  const lat = Number(row?.weather_lat);
  const lon = Number(row?.weather_lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function buildExternalCatches(rows, limit = 20, clubCoords = null) {
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

async function fetchRecentPageViewsForActiveUsers(clubId, sinceIso) {
  const rows = [];
  let rangeStart = 0;
  let encounteredError = null;

  while (rows.length < PAGE_VIEW_RECENT_LIMIT) {
    const rangeEnd = rangeStart + PAGE_VIEW_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('page_views')
      .select('id, angler, created_at')
      .eq('club_id', clubId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rangeStart, rangeEnd);

    if (error) {
      encounteredError = error;
      break;
    }

    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_VIEW_PAGE_SIZE) break;
    rangeStart += PAGE_VIEW_PAGE_SIZE;
  }

  return { rows, error: encounteredError };
}

function getPageViewRange(pageViewYearFilter, snapshotIso) {
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

export default function AdminOverview({
  clubIdOverride = null,
  title = '🔧 Adminbereich‑Übersicht',
  showTelemetry = true,
} = {}) {
  const currentYear = new Date().getFullYear();
  const effectiveClubId = useMemo(() => {
    if (clubIdOverride && typeof clubIdOverride === 'string') return clubIdOverride;
    return getActiveClubId();
  }, [clubIdOverride]);
  const currentYearFilter = String(currentYear);
  const [activeUsers, setActiveUsers] = useState([]);
  const [latestCatch, setLatestCatch] = useState(null);
  const [nameShort, setNameShort] = useState(null);
  const [recentBlanks, setRecentBlanks] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [externalCatches, setExternalCatches] = useState([]);
  const [takenCatches, setTakenCatches] = useState([]);
  const [pushByAngler, setPushByAngler] = useState([]);
  const [pushDeviceSummary, setPushDeviceSummary] = useState([]);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState('');
  const [battLatest, setBattLatest] = useState(null);
  const [battCount, setBattCount] = useState(null);
  const [gpsLatest, setGpsLatest] = useState(null);
  const [gpsCount, setGpsCount] = useState(null);
  const [temperatureLatest, setTemperatureLatest] = useState(null);
  const [temperatureCount, setTemperatureCount] = useState(null);
  const [pageViewRows, setPageViewRows] = useState([]);
  const [pageViewYearFilter, setPageViewYearFilter] = useState(currentYearFilter);
  const [pageViewLoading, setPageViewLoading] = useState(false);
  const [pageViewError, setPageViewError] = useState('');
  const [pageViewStatsLoading, setPageViewStatsLoading] = useState(false);
  const [pageViewStatsError, setPageViewStatsError] = useState('');
  const [pageViewDbYears, setPageViewDbYears] = useState(null);
  const [pageViewDbMonthlyCounts, setPageViewDbMonthlyCounts] = useState(null);
  const [pageViewUniqueOpenPath, setPageViewUniqueOpenPath] = useState(null);

  const navLabelMap = useMemo(() => {
    const map = new Map();
    const addItem = (item) => {
      if (!item) return;
      if (item.path) map.set(normalizePath(item.path), item.label);
      if (Array.isArray(item.children)) item.children.forEach(addItem);
    };

    navItemsFor({
      hasFeatureForRole: () => true,
      hasAtLeastRole: () => true,
    }).forEach(addItem);

    [
      ['/settings', 'Einstellungen'],
    ].forEach(([path, label]) => {
      map.set(normalizePath(path), label);
    });

    return map;
  }, []);

  const labelForPath = useCallback(
    (value) => {
      if (!value) return '—';
      if (typeof value !== 'string') return String(value);
      if (value === '—') return value;
      if (value.includes('://')) return value;
      const normalized = normalizePath(value);
      return navLabelMap.get(normalized) || value;
    },
    [navLabelMap],
  );
  const formatDateTimeLabel = (value) => {
    const parsed = parseTimestamp(value);
    if (!parsed) return 'unbekannt';
    return formatDateTime(parsed);
  };

  const formatDateLabel = (value) => {
    const parsed = parseTimestamp(value);
    if (!parsed) return 'unbekannt';
    return formatDateOnly(parsed);
  };

  const filteredPageViewRows = useMemo(() => filterPageViewRows(pageViewRows), [pageViewRows]);
  const pageViewAvailableYearsFallback = useMemo(
    () => getPageViewAvailableYears(filteredPageViewRows),
    [filteredPageViewRows]
  );
  const pageViewAvailableYears = useMemo(
    () => Array.from(new Set([currentYear, ...(pageViewDbYears || pageViewAvailableYearsFallback)])).sort((a, b) => b - a),
    [currentYear, pageViewDbYears, pageViewAvailableYearsFallback]
  );
  const pageViewRowsInScope = useMemo(
    () => filterPageViewRowsByYear(filteredPageViewRows, pageViewYearFilter),
    [filteredPageViewRows, pageViewYearFilter]
  );
  const pageViewYearOptions = useMemo(
    () => [
      { value: PAGE_VIEW_YEAR_FILTER_ALL, label: 'Alle' },
      ...pageViewAvailableYears.map((year) => ({ value: String(year), label: String(year) })),
    ],
    [pageViewAvailableYears]
  );
  const pageViewRangeLabel = pageViewYearFilter === PAGE_VIEW_YEAR_FILTER_ALL
    ? 'Alle Jahre'
    : `Gesamtjahr ${pageViewYearFilter}`;

  const pageViewAggregates = useMemo(
    () => groupPageViews(pageViewRowsInScope).map((entry) => ({
      ...entry,
      label: labelForPath(entry.path),
    })),
    [pageViewRowsInScope, labelForPath],
  );
  const pageViewAnglersByPath = useMemo(
    () => buildPageViewAnglersByPath(pageViewRowsInScope),
    [pageViewRowsInScope]
  );
  const uniqueAnglersForPath = useCallback((path) => {
    return getUniqueAnglersForPath(pageViewAnglersByPath, path);
  }, [pageViewAnglersByPath]);
  const pageViewMonthlyStatsFallback = useMemo(
    () => buildPageViewMonthlyStats(pageViewRowsInScope, pageViewYearFilter),
    [pageViewRowsInScope, pageViewYearFilter]
  );
  const pageViewMonthlyStatsFromDb = useMemo(
    () => buildMonthlyStatsFromDbCounts(pageViewDbMonthlyCounts, pageViewYearFilter),
    [pageViewDbMonthlyCounts, pageViewYearFilter]
  );
  const pageViewDbStatsActive = Array.isArray(pageViewMonthlyStatsFromDb);
  const pageViewMonthlyStats = pageViewDbStatsActive
    ? pageViewMonthlyStatsFromDb
    : pageViewMonthlyStatsFallback;
  const pageViewMonthlyStatsVisible = useMemo(
    () => pageViewMonthlyStats.filter((row) => (Number(row?.total) || 0) > 0),
    [pageViewMonthlyStats]
  );
  const pageViewTotal = pageViewDbStatsActive
    ? pageViewMonthlyStats.reduce((sum, row) => sum + (Number(row?.total) || 0), 0)
    : pageViewRowsInScope.length;
  const pageViewAverage = pageViewAggregates.length > 0
    ? (pageViewTotal / pageViewAggregates.length).toFixed(1)
    : '0.0';
  const pageViewTopAnglers = useMemo(
    () => buildPageViewTopAnglers(pageViewRowsInScope),
    [pageViewRowsInScope]
  );
  const pageViewSectionLoading = pageViewLoading || pageViewStatsLoading;
  const pageViewSectionError = pageViewError || pageViewStatsError;
  const latestBuildByAngler = useMemo(() => {
    const byAngler = new Map();

    (pageViewRows || []).forEach((entry) => {
      const key = normalizeName(entry?.angler);
      if (!key) return;

      const buildInfo = parseBuildMetadata(entry?.metadata);
      if (!buildInfo.build && !buildInfo.commit) return;
      const createdAt = parseTimestamp(entry?.created_at);
      if (!createdAt) return;

      const prev = byAngler.get(key);
      if (!prev || createdAt > prev.createdAt) {
        byAngler.set(key, {
          ...buildInfo,
          createdAt,
        });
      }
    });

    return byAngler;
  }, [pageViewRows]);
  const getBuildInfoForUser = useCallback(
    (rawName) => {
      const key = normalizeName(rawName);
      if (!key) return null;
      const info = latestBuildByAngler.get(key);
      if (!info) return null;
      const label = formatBuildLabel(info);
      if (!label) return null;
      return {
        label,
        createdAt: info.createdAt?.toISOString?.() || null,
      };
    },
    [latestBuildByAngler],
  );

  useEffect(() => {
    let active = true;
    const clubId = effectiveClubId;
    const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sinceIso = sinceDate.toISOString();

    if (!clubId) return () => { active = false; };

    const logSectionError = (section, error) => {
      console.error(`AdminOverview: ${section} konnten nicht geladen werden`, error);
    };

    const resolveQueryData = async (queryPromise, section) => {
      try {
        const { data, error } = await queryPromise;
        if (error) {
          logSectionError(section, error);
          return null;
        }
        return data;
      } catch (error) {
        logSectionError(section, error);
        return null;
      }
    };

    const allProfilesDataPromise = resolveQueryData(
      supabase
        .from('profiles')
        .select('id, name, created_at, role')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false }),
      'Profile',
    );
    const fishSnapshotPromise = resolveQueryData(
      supabase
        .from('fishes')
        .select('angler, fish, size, timestamp, lat, lon, location_name, blank, taken')
        .eq('club_id', clubId)
        .order('timestamp', { ascending: false })
        .limit(ADMIN_OVERVIEW_FISH_SNAPSHOT_LIMIT),
      'Fänge (Snapshot)',
    );
    const clubCoordsPromise = resolveQueryData(
      supabase
        .from('clubs')
        .select('weather_lat, weather_lon')
        .eq('id', clubId)
        .maybeSingle(),
      'Club-Koordinaten',
    );

    async function loadActiveUsers() {
      const [users, allProfilesData, fishSnapshot, recentPageViewsResult] = await Promise.all([
        resolveQueryData(
          supabase
            .from('user_activity')
            .select('user_id, angler_name, last_active')
            .eq('club_id', clubId),
          'Aktive Angler (user_activity)',
        ),
        allProfilesDataPromise,
        fishSnapshotPromise,
        fetchRecentPageViewsForActiveUsers(clubId, sinceIso),
      ]);

      if (!active) return;

      const safeUsers = Array.isArray(users) ? users : [];
      const profileById = new Map((allProfilesData || []).map((profile) => [profile.id, profile.name]));
      const activeByName = new Map();

      const upsertActive = (rawName, rawTimestamp) => {
        const name = String(rawName || '').trim();
        if (!name) return;
        const parsed = parseTimestamp(rawTimestamp);
        if (!parsed) return;
        const key = normalizeName(name);
        if (!key) return;
        const prev = activeByName.get(key);
        if (!prev || parsed > prev.lastActive) {
          activeByName.set(key, {
            name,
            lastActive: parsed,
          });
        }
      };

      safeUsers.forEach((entry) => {
        const profileName = entry?.user_id ? profileById.get(entry.user_id) : null;
        const resolvedName = profileName || entry?.angler_name || null;
        const parsedLastActive = parseTimestamp(entry?.last_active);
        if (parsedLastActive && parsedLastActive > sinceDate) {
          upsertActive(resolvedName, entry?.last_active);
        }
      });

      (fishSnapshot || []).forEach((entry) => {
        const ts = parseTimestamp(entry?.timestamp);
        if (!ts || ts <= sinceDate) return;
        upsertActive(entry?.angler, entry?.timestamp);
      });

      if (recentPageViewsResult?.error) {
        logSectionError('Aktive Angler (page_views)', recentPageViewsResult.error);
      } else {
        (recentPageViewsResult?.rows || []).forEach((entry) => {
          upsertActive(entry?.angler, entry?.created_at);
        });
      }

      setActiveUsers(
        [...activeByName.values()]
          .map((entry) => ({
            name: entry.name,
            last_active: entry.lastActive.toISOString(),
          }))
          .sort(
            (a, b) =>
              (parseTimestamp(b.last_active)?.getTime() || 0) -
              (parseTimestamp(a.last_active)?.getTime() || 0)
          )
      );
    }

    async function loadTakenCatches() {
      const fishSnapshot = await fishSnapshotPromise;

      if (!active) return;
      const rows = Array.isArray(fishSnapshot) ? fishSnapshot : [];
      const takenFromSnapshot = rows.filter((entry) => entry?.taken === true).slice(0, 100);

      if (rows.length < ADMIN_OVERVIEW_FISH_SNAPSHOT_LIMIT || takenFromSnapshot.length >= 100) {
        setTakenCatches(takenFromSnapshot);
        return;
      }

      const takenFallback = await resolveQueryData(
        supabase
          .from('fishes')
          .select('angler, fish, timestamp')
          .eq('club_id', clubId)
          .eq('taken', true)
          .order('timestamp', { ascending: false })
          .limit(100),
        'Entnommene Fische',
      );
      if (!active) return;
      setTakenCatches(Array.isArray(takenFallback) ? takenFallback : takenFromSnapshot);
    }

    async function loadFishOverview() {
      const [fishSnapshot, clubCoordsRow] = await Promise.all([
        fishSnapshotPromise,
        clubCoordsPromise,
      ]);
      if (!active) return;
      const clubCoords = parseClubCoords(clubCoordsRow);

      const rows = Array.isArray(fishSnapshot) ? fishSnapshot : [];
      const latest = buildLatestCatch(rows);
      setLatestCatch(latest);
      setNameShort(latest?.angler || null);

      setRecentBlanks(buildRecentBlanks(rows, sinceDate));

      let externals = buildExternalCatches(rows, 20, clubCoords);
      if (rows.length >= ADMIN_OVERVIEW_FISH_SNAPSHOT_LIMIT && externals.length < 20) {
        const externalFallback = await resolveQueryData(
          supabase
            .from('fishes')
            .select('angler, fish, size, timestamp, lat, lon, location_name, blank')
            .eq('club_id', clubId)
            .not('lat', 'is', null)
            .not('lon', 'is', null)
            .order('timestamp', { ascending: false })
            .limit(200),
          'Externe Fänge',
        );
        if (!active) return;
        if (Array.isArray(externalFallback)) {
          externals = buildExternalCatches(externalFallback, 20, clubCoords);
        }
      }

      setExternalCatches(externals);
    }

    async function loadProfiles() {
      const profiles = await allProfilesDataPromise;
      if (!active) return;
      setAllProfiles(Array.isArray(profiles) ? profiles : []);
    }

    async function loadPushSubscribers() {
      const [allProfilesData, pushSubs] = await Promise.all([
        allProfilesDataPromise,
        resolveQueryData(
          supabase
            .from('push_subscriptions')
            .select('user_id, angler_name, device_label, opted_in, revoked_at')
            .eq('club_id', clubId),
          'Push-Abonnenten',
        ),
      ]);

      if (!active) return;

      if (!Array.isArray(pushSubs)) {
        setPushByAngler([]);
        setPushDeviceSummary([]);
        return;
      }

      const profileNameById = (allProfilesData || []).reduce((acc, profile) => {
        if (profile?.id) acc[profile.id] = profile.name || null;
        return acc;
      }, {});

      const byAngler = pushSubs.reduce((acc, entry) => {
        const fallbackName = entry?.user_id ? profileNameById[entry.user_id] : null;
        const label = entry?.angler_name?.trim() || fallbackName || 'Unbekannt';
        if (!acc[label]) acc[label] = { total: 0, active: 0 };
        acc[label].total += 1;
        if (entry?.opted_in && !entry?.revoked_at) acc[label].active += 1;
        return acc;
      }, {});

      const byDevice = pushSubs.reduce((acc, entry) => {
        const label = entry?.device_label?.trim() || 'Unbekanntes Gerät';
        if (!acc[label]) acc[label] = { total: 0, active: 0 };
        acc[label].total += 1;
        if (entry?.opted_in && !entry?.revoked_at) acc[label].active += 1;
        return acc;
      }, {});

      const sortedAngler = Object.entries(byAngler)
        .map(([name, counts]) => ({ name, ...counts }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

      const sortedDevices = Object.entries(byDevice)
        .map(([device, counts]) => ({ device, ...counts }))
        .sort((a, b) => b.total - a.total || a.device.localeCompare(b.device));

      setPushByAngler(sortedAngler);
      setPushDeviceSummary(sortedDevices);
    }

    const runLoad = (section, loader) => {
      loader().catch((error) => {
        logSectionError(section, error);
      });
    };

    runLoad('Aktive Angler', loadActiveUsers);
    runLoad('Entnommene Fische', loadTakenCatches);
    runLoad('Fang-Übersicht', loadFishOverview);
    runLoad('Profile', loadProfiles);
    runLoad('Push-Abonnenten', loadPushSubscribers);

    return () => {
      active = false;
    };
  }, [effectiveClubId]);

  useEffect(() => {
    let active = true;

    async function loadPageViews() {
      setPageViewLoading(true);
      setPageViewError('');

      const clubId = effectiveClubId;
      const snapshotIso = new Date().toISOString();

      const { fromIso, toIso, upperBoundOp } = getPageViewRange(pageViewYearFilter, snapshotIso);

      const allRows = [];
      let rangeStart = 0;
      let pagesLoaded = 0;
      let encounteredError = null;

      while (pagesLoaded < PAGE_VIEW_MAX_FETCH_PAGES) {
        const rangeEnd = rangeStart + PAGE_VIEW_PAGE_SIZE - 1;
        let query = supabase
          .from('page_views')
          .select('id, path, angler, created_at, metadata')
          .eq('club_id', clubId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(rangeStart, rangeEnd);

        if (fromIso) query = query.gte('created_at', fromIso);
        if (toIso) {
          query = upperBoundOp === 'lt'
            ? query.lt('created_at', toIso)
            : query.lte('created_at', toIso);
        }

        const { data, error } = await query;

        if (!active) return;

        if (error) {
          encounteredError = error;
          break;
        }

        if (Array.isArray(data) && data.length > 0) {
          allRows.push(...data);
          if (data.length < PAGE_VIEW_PAGE_SIZE) break;
        } else {
          break;
        }

        rangeStart += PAGE_VIEW_PAGE_SIZE;
        pagesLoaded += 1;
      }

      if (encounteredError) {
        console.error('PageViews: Laden fehlgeschlagen', encounteredError);
        setPageViewError(encounteredError.message || 'Page-Views konnten nicht geladen werden.');
        setPageViewRows([]);
      } else {
        setPageViewRows(allRows);
        if (pagesLoaded >= PAGE_VIEW_MAX_FETCH_PAGES) {
          setPageViewError('Page-Views wurden nur teilweise geladen (Maximalgrenze erreicht).');
        }
      }

      setPageViewLoading(false);
    }

    loadPageViews();
    return () => {
      active = false;
    };
  }, [effectiveClubId, pageViewYearFilter]);

  useEffect(() => {
    let active = true;

    async function loadPageViewStats() {
      setPageViewStatsLoading(true);
      setPageViewStatsError('');

      const clubId = effectiveClubId;
      if (!clubId) {
        setPageViewDbYears(null);
        setPageViewDbMonthlyCounts(null);
        setPageViewStatsLoading(false);
        return;
      }

      const selectedYear = pageViewYearFilter === PAGE_VIEW_YEAR_FILTER_ALL
        ? null
        : Number(pageViewYearFilter);

      try {
        const [yearsResult, monthlyResult] = await Promise.all([
          supabase.rpc('admin_page_view_years', {
            p_club_id: clubId,
            p_excluded_angler: PAGE_VIEW_EXCLUDED_ANGLER,
          }),
          supabase.rpc('admin_page_view_monthly_counts', {
            p_club_id: clubId,
            p_year: Number.isInteger(selectedYear) ? selectedYear : null,
            p_excluded_angler: PAGE_VIEW_EXCLUDED_ANGLER,
          }),
        ]);

        if (!active) return;

        if (isMissingPageViewRpcError(yearsResult.error) || isMissingPageViewRpcError(monthlyResult.error)) {
          setPageViewDbYears(null);
          setPageViewDbMonthlyCounts(null);
          return;
        }

        if (yearsResult.error || monthlyResult.error) {
          setPageViewStatsError(
            yearsResult.error?.message
              || monthlyResult.error?.message
              || 'Page-View-Statistik konnte nicht vollständig geladen werden.'
          );
          setPageViewDbYears(null);
          setPageViewDbMonthlyCounts(null);
          return;
        }

        const years = (yearsResult.data || [])
          .map((row) => Number(row?.year))
          .filter((year) => Number.isInteger(year))
          .sort((a, b) => b - a);

        setPageViewDbYears(years);
        setPageViewDbMonthlyCounts(Array.isArray(monthlyResult.data) ? monthlyResult.data : []);
      } catch (error) {
        if (!active) return;
        setPageViewStatsError(error?.message || 'Page-View-Statistik konnte nicht geladen werden.');
        setPageViewDbYears(null);
        setPageViewDbMonthlyCounts(null);
      } finally {
        if (active) setPageViewStatsLoading(false);
      }
    }

    loadPageViewStats();
    return () => {
      active = false;
    };
  }, [effectiveClubId, pageViewYearFilter]);

  useEffect(() => {
    if (pageViewYearFilter === PAGE_VIEW_YEAR_FILTER_ALL) return;
    const selectedYear = Number(pageViewYearFilter);
    if (!Number.isInteger(selectedYear)) {
      setPageViewYearFilter(currentYearFilter);
      return;
    }
    if (!pageViewAvailableYears.includes(selectedYear)) {
      setPageViewYearFilter(currentYearFilter);
    }
  }, [currentYearFilter, pageViewAvailableYears, pageViewYearFilter]);

  useEffect(() => {
    let active = true;
    if (!showTelemetry) {
      setTelemetryLoading(false);
      setTelemetryError('');
      return () => {
        active = false;
      };
    }

    async function loadTelemetryLogs() {
      setTelemetryLoading(true);
      setTelemetryError('');

      try {
        const [
          battLatestResult,
          battCountResult,
          gpsLatestResult,
          gpsCountResult,
          temperatureLatestResult,
          temperatureCountResult,
        ] = await Promise.all([
          supabase
            .from('batt_log')
            .select('voltage_v, percent, created_at, measured_at, device_id, topic, valid')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('batt_log')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('gps_log')
            .select('device_id, topic, created_at, fix_time_utc, lat, lon, fix, sats, sats_used, sats_view')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('gps_log')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('temperature_log')
            .select('device_id, topic, created_at, measured_at, temperature_c')
            .order('measured_at', { ascending: false })
            .limit(1),
          supabase
            .from('temperature_log')
            .select('id', { count: 'exact', head: true }),
        ]);

        if (!active) return;

        setBattLatest(Array.isArray(battLatestResult?.data) ? battLatestResult.data[0] || null : null);
        setBattCount(Number.isInteger(battCountResult?.count) ? battCountResult.count : null);
        setGpsLatest(Array.isArray(gpsLatestResult?.data) ? gpsLatestResult.data[0] || null : null);
        setGpsCount(Number.isInteger(gpsCountResult?.count) ? gpsCountResult.count : null);
        setTemperatureLatest(
          Array.isArray(temperatureLatestResult?.data) ? temperatureLatestResult.data[0] || null : null
        );
        setTemperatureCount(Number.isInteger(temperatureCountResult?.count) ? temperatureCountResult.count : null);

        const errors = [
          battLatestResult?.error,
          battCountResult?.error,
          gpsLatestResult?.error,
          gpsCountResult?.error,
          temperatureLatestResult?.error,
          temperatureCountResult?.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          const message = errors
            .map((err) => err?.message)
            .filter(Boolean)
            .join(' | ');
          setTelemetryError(message || 'Sensor-Logs konnten nicht vollständig geladen werden.');
          console.error('Sensor-Logs: Laden fehlgeschlagen', errors);
        }
      } catch (error) {
        if (!active) return;
        const message = error?.message || 'Sensor-Logs konnten nicht geladen werden.';
        setTelemetryError(message);
        console.error('Sensor-Logs: Unerwarteter Fehler', error);
      } finally {
        if (active) setTelemetryLoading(false);
      }
    }

    loadTelemetryLogs();
    return () => {
      active = false;
    };
  }, [showTelemetry]);

  useEffect(() => {
    setPageViewUniqueOpenPath(null);
  }, [pageViewAggregates]);

  const listItemClass = "list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-200";
  const fallbackTextClass = "text-sm text-gray-700 dark:text-gray-300";
  const metaTextClass = "text-xs text-gray-400 dark:text-gray-400";

  return (
    <Card className="p-4 max-w-4xl mx-auto text-gray-800 dark:text-gray-100">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6">{title}</h2>

      {showTelemetry ? (
        <SensorLogsSection
          telemetryLoading={telemetryLoading}
          telemetryError={telemetryError}
          battLatest={battLatest}
          battCount={battCount}
          gpsLatest={gpsLatest}
          gpsCount={gpsCount}
          temperatureLatest={temperatureLatest}
          temperatureCount={temperatureCount}
          formatDateTimeLabel={formatDateTimeLabel}
        />
      ) : null}

      <LatestCatchSection
        latestCatch={latestCatch}
        nameShort={nameShort}
        formatDateTimeLabel={formatDateTimeLabel}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
      />

      <RecentBlanksSection
        recentBlanks={recentBlanks}
        formatDateTimeLabel={formatDateTimeLabel}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
      />

      <ActiveUsersSection
        activeUsers={activeUsers}
        formatDateTimeLabel={formatDateTimeLabel}
        getBuildInfoForUser={getBuildInfoForUser}
        listItemClass={listItemClass}
        metaTextClass={metaTextClass}
      />

      <TakenCatchesSection
        takenCatches={takenCatches}
        formatDateTimeLabel={formatDateTimeLabel}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
      />

      <ExternalCatchesSection
        externalCatches={externalCatches}
        formatDateTimeLabel={formatDateTimeLabel}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
      />

      <PageViewsSection
        pageViewLoading={pageViewSectionLoading}
        pageViewTotal={pageViewTotal}
        pageViewRangeLabel={pageViewRangeLabel}
        pageViewYearFilter={pageViewYearFilter}
        pageViewYearOptions={pageViewYearOptions}
        setPageViewYearFilter={setPageViewYearFilter}
        pageViewAggregates={pageViewAggregates}
        pageViewAverage={pageViewAverage}
        pageViewError={pageViewSectionError}
        pageViewMonthlyStats={pageViewMonthlyStatsVisible}
        pageViewTopAnglers={pageViewTopAnglers}
        fallbackTextClass={fallbackTextClass}
        formatDateTimeLabel={formatDateTimeLabel}
        pageViewUniqueOpenPath={pageViewUniqueOpenPath}
        uniqueAnglersForPath={uniqueAnglersForPath}
        setPageViewUniqueOpenPath={setPageViewUniqueOpenPath}
      />
      <RegisteredUsersSection
        allProfiles={allProfiles}
        formatDateLabel={formatDateLabel}
        getBuildInfoForUser={getBuildInfoForUser}
        listItemClass={listItemClass}
        metaTextClass={metaTextClass}
      />

      <PushSubscribersSection
        pushByAngler={pushByAngler}
        pushDeviceSummary={pushDeviceSummary}
        listItemClass={listItemClass}
        fallbackTextClass={fallbackTextClass}
        metaTextClass={metaTextClass}
      />

      <OneSignalDebugSection />
    </Card>
  );
}
