import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { formatDateOnly, formatDateTime, parseTimestamp, formatTimeOnly } from '@/utils/dateUtils';
import { navItemsFor } from '@/config/navItems';
import { APP_VERSION } from '@/utils/buildInfo';
import { Card } from '@/components/ui';
import PageViewsSection from '@/features/adminOverview/components/PageViewsSection';
import ActiveUsersSection from '@/features/adminOverview/components/ActiveUsersSection';
import ExternalCatchesSection from '@/features/adminOverview/components/ExternalCatchesSection';
import LatestCatchSection from '@/features/adminOverview/components/LatestCatchSection';
import OneSignalDebugSection from '@/features/adminOverview/components/OneSignalDebugSection';
import OverviewSection from '@/features/adminOverview/components/OverviewSection';
import PushSubscribersSection from '@/features/adminOverview/components/PushSubscribersSection';
import RecentBlanksSection from '@/features/adminOverview/components/RecentBlanksSection';
import RegisteredUsersSection from '@/features/adminOverview/components/RegisteredUsersSection';
import SensorLogsSection from '@/features/adminOverview/components/SensorLogsSection';
import TakenCatchesSection from '@/features/adminOverview/components/TakenCatchesSection';
import {
  PAGE_VIEW_LIMIT,
  PAGE_VIEW_PAGE_SIZE,
  buildPageViewAnglersByPath,
  buildPageViewLastEvents,
  buildPageViewMonthlyStats,
  buildPageViewTopAnglers,
  filterPageViewRows,
  getUniqueAnglersForPath,
  groupPageViews,
  normalizeName,
  normalizePath,
} from '@/features/adminOverview/pageViewUtils';

export default function AdminOverview() {
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [latestCatch, setLatestCatch] = useState(null);
  const [catchCount, setCatchCount] = useState(null);
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
  const [pageViewYearStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
  });
  const [pageViewRows, setPageViewRows] = useState([]);
  const [pageViewLoading, setPageViewLoading] = useState(false);
  const [pageViewError, setPageViewError] = useState('');
  const [latestAppActivityByName, setLatestAppActivityByName] = useState({});
  const [pageViewLastLimit, setPageViewLastLimit] = useState(20);
  const [pageViewUniqueOpenPath, setPageViewUniqueOpenPath] = useState(null);
  const pageViewYearLabel = pageViewYearStart.getFullYear();

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

  const formatTimeLabel = (value) => {
    const parsed = parseTimestamp(value);
    if (!parsed) return 'unbekannt';
    return formatTimeOnly(parsed);
  };

  const filteredPageViewRows = useMemo(() => filterPageViewRows(pageViewRows), [pageViewRows]);

  const pageViewAggregates = useMemo(
    () => groupPageViews(filteredPageViewRows).map((entry) => ({
      ...entry,
      label: labelForPath(entry.path),
    })),
    [filteredPageViewRows, labelForPath],
  );
  const pageViewAnglersByPath = useMemo(
    () => buildPageViewAnglersByPath(filteredPageViewRows),
    [filteredPageViewRows]
  );
  const uniqueAnglersForPath = useCallback((path) => {
    return getUniqueAnglersForPath(pageViewAnglersByPath, path);
  }, [pageViewAnglersByPath]);
  const pageViewTotal = filteredPageViewRows.length;
  const pageViewAverage = pageViewAggregates.length > 0
    ? (pageViewTotal / pageViewAggregates.length).toFixed(1)
    : '0.0';
  const pageViewMonthlyStats = useMemo(
    () => buildPageViewMonthlyStats(filteredPageViewRows, pageViewYearStart),
    [filteredPageViewRows, pageViewYearStart]
  );
  const currentBuildLabel = useMemo(
    () => (APP_VERSION ? String(APP_VERSION).trim() : null),
    [],
  );
  const pageViewTopAnglers = useMemo(
    () => buildPageViewTopAnglers(filteredPageViewRows, latestAppActivityByName),
    [filteredPageViewRows, latestAppActivityByName]
  );
  const pageViewLastEvents = useMemo(
    () =>
      buildPageViewLastEvents({
        filteredRows: filteredPageViewRows,
        pageViewTopAnglers,
        labelForPath,
        currentBuildLabel,
        pageViewLastLimit,
      }),
    [pageViewTopAnglers, filteredPageViewRows, labelForPath, currentBuildLabel, pageViewLastLimit]
  );
  const pageViewLastEventsSourceCount = pageViewTopAnglers.length;

  useEffect(() => {
    async function loadData() {
      try {
        const clubId = getActiveClubId();
        const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const sinceIso = sinceDate.toISOString();
        const pageViewYearStartIso = pageViewYearStart.toISOString();
        const { data: weatherData } = await supabase
          .from('weather_cache')
          .select('updated_at')
          .eq('club_id', clubId)
          .eq('id', 'latest')
          .single();

        if (weatherData?.updated_at) {
          const label = formatTimeLabel(weatherData.updated_at);
          if (label !== 'unbekannt') setWeatherUpdatedAt(label);
        }

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
        const latestByName = new Map();

        const upsertLatest = (rawName, rawTimestamp) => {
          const name = String(rawName || '').trim();
          if (!name) return;
          const parsed = parseTimestamp(rawTimestamp);
          if (!parsed) return;
          const key = normalizeName(name);
          if (!key) return;
          const prev = latestByName.get(key);
          if (!prev || parsed > prev.lastActive) {
            latestByName.set(key, {
              name,
              lastActive: parsed,
            });
          }
        };

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
          upsertLatest(resolvedName, entry?.last_active);
          if (parsedLastActive && parsedLastActive > sinceDate) {
            upsertActive(resolvedName, entry?.last_active);
          }
        });

        const { data: sessionsForTopAnglers } = await supabase
          .from('fishes')
          .select('angler, timestamp')
          .eq('club_id', clubId)
          .gte('timestamp', pageViewYearStartIso)
          .order('timestamp', { ascending: false })
          .limit(5000);

        (sessionsForTopAnglers || []).forEach((entry) => {
          upsertLatest(entry?.angler, entry?.timestamp);
        });

        setLatestAppActivityByName(
          Object.fromEntries(
            [...latestByName.entries()].map(([key, entry]) => [key, entry.lastActive.toISOString()])
          )
        );

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

        const { count } = await supabase
          .from('fishes')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', clubId)
          .not('fish', 'is', null)
          .neq('fish', '');
        setCatchCount(count);

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
  }, [pageViewYearStart]);

  useEffect(() => {
    let active = true;

    async function loadPageViews() {
      setPageViewLoading(true);
      setPageViewError('');

      const since = pageViewYearStart.toISOString();
      const clubId = getActiveClubId();

      const allRows = [];
      let rangeStart = 0;
      let encounteredError = null;

      while (allRows.length < PAGE_VIEW_LIMIT) {
        const rangeEnd = rangeStart + PAGE_VIEW_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('page_views')
          .select('path, full_path, angler, session_id, created_at, metadata')
          .eq('club_id', clubId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
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
      }

      if (encounteredError) {
        console.error('PageViews: Laden fehlgeschlagen', encounteredError);
        setPageViewError(encounteredError.message || 'Page-Views konnten nicht geladen werden.');
        setPageViewRows([]);
      } else {
        setPageViewRows(allRows.slice(0, PAGE_VIEW_LIMIT));
      }

      setPageViewLoading(false);
    }

    loadPageViews();
    return () => {
      active = false;
    };
  }, [pageViewYearStart]);

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
    setPageViewLastLimit(20);
  }, [filteredPageViewRows.length]);

  useEffect(() => {
    setPageViewUniqueOpenPath(null);
  }, [pageViewAggregates]);

  const listItemClass = "list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-200";
  const fallbackTextClass = "text-sm text-gray-700 dark:text-gray-300";
  const metaTextClass = "text-xs text-gray-400 dark:text-gray-400";

  return (
    <Card className="p-4 max-w-4xl mx-auto text-gray-800 dark:text-gray-100">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6">🔧 Admin2‑Übersicht</h2>

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

      <OverviewSection title="☁️ Letzte Wetteraktualisierung" value={weatherUpdatedAt || 'Lade...'} />
      <OverviewSection title="🎣 Gesamtanzahl Fänge" value={catchCount === null ? 'Lade...' : catchCount} />

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
        pageViewLoading={pageViewLoading}
        pageViewTotal={pageViewTotal}
        pageViewYearLabel={pageViewYearLabel}
        pageViewAggregates={pageViewAggregates}
        pageViewAverage={pageViewAverage}
        pageViewError={pageViewError}
        pageViewMonthlyStats={pageViewMonthlyStats}
        pageViewTopAnglers={pageViewTopAnglers}
        fallbackTextClass={fallbackTextClass}
        formatDateTimeLabel={formatDateTimeLabel}
        pageViewUniqueOpenPath={pageViewUniqueOpenPath}
        uniqueAnglersForPath={uniqueAnglersForPath}
        setPageViewUniqueOpenPath={setPageViewUniqueOpenPath}
        pageViewLastEvents={pageViewLastEvents}
        pageViewLastEventsSourceCount={pageViewLastEventsSourceCount}
        pageViewLastLimit={pageViewLastLimit}
        setPageViewLastLimit={setPageViewLastLimit}
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
