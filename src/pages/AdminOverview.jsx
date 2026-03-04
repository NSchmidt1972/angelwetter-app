import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { formatDateOnly, formatDateTime, parseTimestamp } from '@/utils/dateUtils';
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

const PAGE_VIEW_EXCLUDED_ANGLER = 'nicol schmidt';

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

export default function AdminOverview() {
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
  const [pageViewYearFilter, setPageViewYearFilter] = useState(PAGE_VIEW_YEAR_FILTER_ALL);
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

    navItemsFor({ isAdmin: true, canAccessBoard: true }).forEach(addItem);

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
  const pageViewAvailableYears = pageViewDbYears || pageViewAvailableYearsFallback;
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

  useEffect(() => {
    async function loadData() {
      try {
        const clubId = getActiveClubId();
        const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const sinceIso = sinceDate.toISOString();

        const { data: users } = await supabase
          .from('user_activity')
          .select('user_id, angler_name, last_active')
          .eq('club_id', clubId);

        const safeUsers = Array.isArray(users) ? users : [];
        const userIds = safeUsers.map((u) => u?.user_id).filter(Boolean);
        let profileById = new Map();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .eq('club_id', clubId)
            .in('id', userIds);
          profileById = new Map((profiles || []).map((p) => [p.id, p.name]));
        }

        // Aktivität nicht nur aus user_activity, sondern auch aus echten Sessions (inkl. Schneider).
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

        const { data: recentSessions } = await supabase
          .from('fishes')
          .select('angler, timestamp, blank, fish')
          .eq('club_id', clubId)
          .gt('timestamp', sinceIso)
          .order('timestamp', { ascending: false })
          .limit(1000);

        (recentSessions || []).forEach((entry) => {
          upsertActive(entry?.angler, entry?.timestamp);
        });

        // App-Aktivität aus Page-Views der letzten 7 Tage ergänzen,
        // damit "Aktive Angler" und "Aktivste Angler" konsistent bleiben.
        const recentPageViews = [];
        let pageViewRangeStart = 0;
        let pageViewError = null;

        while (recentPageViews.length < PAGE_VIEW_RECENT_LIMIT) {
          const pageViewRangeEnd = pageViewRangeStart + PAGE_VIEW_PAGE_SIZE - 1;
          const { data, error } = await supabase
            .from('page_views')
            .select('id, angler, created_at')
            .eq('club_id', clubId)
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(pageViewRangeStart, pageViewRangeEnd);

          if (error) {
            pageViewError = error;
            break;
          }

          if (!Array.isArray(data) || data.length === 0) break;
          recentPageViews.push(...data);
          if (data.length < PAGE_VIEW_PAGE_SIZE) break;
          pageViewRangeStart += PAGE_VIEW_PAGE_SIZE;
        }

        if (pageViewError) {
          console.error('Aktive Angler: Page-Views konnten nicht geladen werden', pageViewError);
        } else {
          recentPageViews.forEach((entry) => {
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

        // ⬇️ Entnommene Fische (taken = true)
        const { data: taken } = await supabase
          .from('fishes')
          .select('angler, fish, timestamp')
          .eq('club_id', clubId)
          .eq('taken', true)
          .order('timestamp', { ascending: false })
          .limit(100);

        setTakenCatches(taken || []);


        const { data: fishes } = await supabase
          .from('fishes')
          .select('*')
          .eq('club_id', clubId)
          .order('timestamp', { ascending: false })
          .not('blank', 'is', true)
          .limit(1);

        setLatestCatch(fishes?.[0] || null);
        if (fishes?.[0]?.angler) setNameShort(fishes[0].angler);

        const { data: blanks } = await supabase
          .from('fishes')
          .select('angler, timestamp')
          .eq('club_id', clubId)
          .eq('blank', true)
          .gt('timestamp', sinceIso)
          .order('timestamp', { ascending: false });
        setRecentBlanks(blanks);

        const { data: allProfilesData } = await supabase
          .from('profiles')
          .select('id, name, created_at, role')
          .eq('club_id', clubId)
          .order('created_at', { ascending: false });
        setAllProfiles(allProfilesData);

        const { data: pushSubs } = await supabase
          .from('push_subscriptions')
          .select('user_id, angler_name, device_label, opted_in, revoked_at')
          .eq('club_id', clubId);

        if (pushSubs) {
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
        } else {
          setPushByAngler([]);
          setPushDeviceSummary([]);
        }

        // ⬇️ Angepasste externe Fänge-Query
        const { data: externals } = await supabase
          .from('fishes')
          .select('angler, fish, size, timestamp, lat, lon, location_name')
          .eq('club_id', clubId)
          .not('lat', 'is', null)
          .not('lon', 'is', null)
          .not('blank', 'is', true)
          .not('location_name', 'ilike', '%lobberich%')
          .not('location_name', 'ilike', '%ferkensbruch%')
          .not('location_name', 'is', null)
          .order('timestamp', { ascending: false })
          .limit(20);

        setExternalCatches(externals);

      } catch (error) {
        console.error('❌ Fehler beim Laden der Admin-Daten:', error.message);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPageViews() {
      setPageViewLoading(true);
      setPageViewError('');

      const clubId = getActiveClubId();
      const snapshotIso = new Date().toISOString();

      const allRows = [];
      let rangeStart = 0;
      let pagesLoaded = 0;
      let encounteredError = null;

      while (pagesLoaded < PAGE_VIEW_MAX_FETCH_PAGES) {
        const rangeEnd = rangeStart + PAGE_VIEW_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('page_views')
          .select('id, path, full_path, angler, session_id, created_at, metadata')
          .eq('club_id', clubId)
          .lte('created_at', snapshotIso)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(rangeStart, rangeEnd);

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
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPageViewStats() {
      setPageViewStatsLoading(true);
      setPageViewStatsError('');

      const clubId = getActiveClubId();
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
  }, [pageViewYearFilter]);

  useEffect(() => {
    if (pageViewYearFilter === PAGE_VIEW_YEAR_FILTER_ALL) return;
    const selectedYear = Number(pageViewYearFilter);
    if (!Number.isInteger(selectedYear)) {
      setPageViewYearFilter(PAGE_VIEW_YEAR_FILTER_ALL);
      return;
    }
    if (!pageViewAvailableYears.includes(selectedYear)) {
      setPageViewYearFilter(PAGE_VIEW_YEAR_FILTER_ALL);
    }
  }, [pageViewAvailableYears, pageViewYearFilter]);

  useEffect(() => {
    let active = true;

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
  }, []);

  useEffect(() => {
    setPageViewUniqueOpenPath(null);
  }, [pageViewAggregates]);

  const listItemClass = "list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-200";
  const fallbackTextClass = "text-sm text-gray-700 dark:text-gray-300";
  const metaTextClass = "text-xs text-gray-400 dark:text-gray-400";

  return (
    <Card className="p-4 max-w-4xl mx-auto text-gray-800 dark:text-gray-100">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6">🔧 Adminbereich‑Übersicht</h2>

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
