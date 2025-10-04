import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import OneSignalHealthCheck from '../components/OneSignalHealthCheck';
import { formatDateOnly, formatDateTime, parseTimestamp, formatTimeOnly } from '@/utils/dateUtils';
import { navItemsFor } from '@/config/navItems';
import { APP_VERSION } from '@/utils/buildInfo';

const PAGE_VIEW_LIMIT = 2000;
const PAGE_VIEW_RANGE_OPTIONS = [
  { value: 7, label: 'Letzte 7 Tage' },
  { value: 30, label: 'Letzte 30 Tage' },
  { value: 90, label: 'Letzte 90 Tage' },
];

function normalizePath(value) {
  if (!value) return '/';
  const pathOnly = value.split('?')[0].split('#')[0];
  const ensured = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  if (ensured.length > 1 && ensured.endsWith('/')) return ensured.slice(0, -1);
  return ensured || '/';
}

function groupPageViews(rows) {
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
  const [pageViewRangeDays, setPageViewRangeDays] = useState(30);
  const [pageViewRows, setPageViewRows] = useState([]);
  const [pageViewLoading, setPageViewLoading] = useState(false);
  const [pageViewError, setPageViewError] = useState('');
  const [pageViewLastLimit, setPageViewLastLimit] = useState(20);

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

  const formatBuildLabel = useCallback((value) => {
    if (!value || typeof value !== 'string') return null;
    if (value === 'dev') return 'dev';

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})\.(\d{2})(\d{2})(?:\+.+)?$/);
    if (!match) return value;

    const [, year, month, day, hh, mm] = match;
    const asDate = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hh),
      Number(mm),
    ));

    return formatDateTime(asDate);
  }, []);

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

  const pageViewAggregates = useMemo(
    () => groupPageViews(pageViewRows).map((entry) => ({
      ...entry,
      label: labelForPath(entry.path),
    })),
    [pageViewRows, labelForPath],
  );
  const pageViewTotal = pageViewRows.length;
  const pageViewAverage = pageViewAggregates.length > 0
    ? (pageViewTotal / pageViewAggregates.length).toFixed(1)
    : '0.0';
  const currentBuildLabel = useMemo(
    () => (APP_VERSION ? String(APP_VERSION).trim() : null),
    [],
  );
  const pageViewLastEvents = useMemo(
    () => pageViewRows.slice(0, pageViewLastLimit).map((row, idx) => {
      const metadata = row && typeof row === 'object' ? row.metadata : null;
      const metadataObj = metadata && typeof metadata === 'object' ? metadata : null;
      const build = metadataObj?.build || metadataObj?.version || null;

      return {
        ...row,
        label: labelForPath(row.path),
        buildLabel: build,
        buildDisplay: formatBuildLabel(build),
        matchesCurrentBuild: (() => {
          const trimmed = build ? String(build).trim() : '';
          return Boolean(trimmed) && Boolean(currentBuildLabel) && trimmed === currentBuildLabel;
        })(),
        key: `${row.created_at || idx}-${row.session_id || 'sess'}`,
      };
    }),
    [pageViewRows, labelForPath, formatBuildLabel, currentBuildLabel, pageViewLastLimit],
  );
  const pageViewTopAnglers = useMemo(() => {
    const stats = new Map();

    pageViewRows.forEach((row) => {
      const rawName = typeof row?.angler === 'string' ? row.angler.trim() : '';
      if (!rawName) return;
      const name = rawName;
      const entry = stats.get(name) || { name, total: 0, lastSeen: null };
      entry.total += 1;

      const createdAt = row?.created_at ? new Date(row.created_at) : null;
      if (createdAt && (!entry.lastSeen || createdAt > entry.lastSeen)) {
        entry.lastSeen = createdAt;
      }

      stats.set(name, entry);
    });

    return [...stats.values()]
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        const timeDiff = (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0);
        if (timeDiff !== 0) return timeDiff;
        return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
      })
      .slice(0, 20);
  }, [pageViewRows]);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: weatherData } = await supabase
          .from('weather_cache')
          .select('updated_at')
          .eq('id', 'latest')
          .single();

        if (weatherData?.updated_at) {
          const label = formatTimeLabel(weatherData.updated_at);
          if (label !== 'unbekannt') setWeatherUpdatedAt(label);
        }

        const { data: users } = await supabase
          .from('user_activity')
          .select('user_id, last_active')
          .gt(
            'last_active',
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          );

        const userIds = users.map((u) => u.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        const enriched = users
          .map((u) => {
            const match = profiles.find((p) => p.id === u.user_id);
            return match ? { ...u, name: match.name } : null;
          })
          .filter(Boolean);
        setActiveUsers(enriched);

        // ⬇️ Entnommene Fische (taken = true)
        const { data: taken } = await supabase
          .from('fishes')
          .select('angler, fish, timestamp')
          .eq('taken', true)
          .order('timestamp', { ascending: false })
          .limit(100);

        setTakenCatches(taken || []);


        const { data: fishes } = await supabase
          .from('fishes')
          .select('*')
          .order('timestamp', { ascending: false })
          .not('blank', 'is', true)
          .limit(1);

        setLatestCatch(fishes?.[0] || null);
        if (fishes?.[0]?.angler) setNameShort(fishes[0].angler);

        const { count } = await supabase
          .from('fishes')
          .select('*', { count: 'exact', head: true })
          .not('fish', 'is', null)
          .neq('fish', '');
        setCatchCount(count);

        const { data: blanks } = await supabase
          .from('fishes')
          .select('angler, timestamp')
          .eq('blank', true)
          .gt(
            'timestamp',
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          )
          .order('timestamp', { ascending: false });
        setRecentBlanks(blanks);

        const { data: allProfilesData } = await supabase
          .from('profiles')
          .select('id, name, created_at')
          .order('created_at', { ascending: false });
        setAllProfiles(allProfilesData);

        const { data: pushSubs } = await supabase
          .from('push_subscriptions')
          .select('user_id, angler_name, device_label, opted_in, revoked_at');

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

      const since = new Date(Date.now() - pageViewRangeDays * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('page_views')
        .select('path, full_path, angler, session_id, created_at, metadata')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(PAGE_VIEW_LIMIT);

      if (!active) return;

      if (error) {
        console.error('PageViews: Laden fehlgeschlagen', error);
        setPageViewError(error.message || 'Page-Views konnten nicht geladen werden.');
        setPageViewRows([]);
      } else {
        setPageViewRows(Array.isArray(data) ? data : []);
      }

      setPageViewLoading(false);
    }

    loadPageViews();
    return () => {
      active = false;
    };
  }, [pageViewRangeDays]);

  useEffect(() => {
    setPageViewLastLimit(20);
  }, [pageViewRangeDays, pageViewRows.length]);


  const Section = ({ title, value, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400">{title}</h3>
        {value && <div className="text-sm text-gray-700 dark:text-gray-300">{value}</div>}
      </div>
      {children}
    </div>
  );

  const listItemClass = "list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-200";
  const fallbackTextClass = "text-sm text-gray-700 dark:text-gray-300";
  const metaTextClass = "text-xs text-gray-400 dark:text-gray-400";
  const totalPushSubscriptions = pushDeviceSummary.reduce((sum, entry) => sum + entry.total, 0);
  const activePushSubscriptions = pushDeviceSummary.reduce((sum, entry) => sum + entry.active, 0);
  const pushSectionLabelBase = totalPushSubscriptions === 1 ? '1 gespeichertes Abo' : `${totalPushSubscriptions} gespeicherte Abos`;
  const pushSectionLabel = `${pushSectionLabelBase} (${activePushSubscriptions} aktiv)`;
  const anglerGroupCount = pushByAngler.length;
  const deviceGroupCount = pushDeviceSummary.length;

  return (
    <div className="p-4 max-w-4xl mx-auto text-gray-800 dark:text-gray-100">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-6">🔧 Admin‑Übersicht</h2>

      <Section title="☁️ Letzte Wetteraktualisierung" value={weatherUpdatedAt || 'Lade...'} />
      <Section title="🎣 Gesamtanzahl Fänge" value={catchCount === null ? 'Lade...' : catchCount} />

      <Section title="🐟 Letzter Fang (7 Tage)">
        {latestCatch ? (
          <div className="max-h-60 overflow-y-auto">
            <ul className={listItemClass}>
              <li>
                {nameShort} – {latestCatch.fish} ({latestCatch.size} cm)
                <span className={metaTextClass}> {' am '}
                  {formatDateTimeLabel(latestCatch.timestamp)}
                </span>
              </li>
            </ul>
          </div>
        ) : (
          <div className={fallbackTextClass}>Keine Daten</div>
        )}
      </Section>


      <Section title="❌ Letzte Schneidersessions (7 Tage)">
        {recentBlanks.length > 0 ? (
          <div className="max-h-60 overflow-y-auto">
            <ul className={listItemClass}>
              {recentBlanks.map((b, i) => (
                <li key={i}>
                  {b.angler}
                  <span className={metaTextClass}> {' am '}
                    {formatDateTimeLabel(b.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={fallbackTextClass}>Keine Schneidersessions</div>
        )}
      </Section>

      <Section title="👥 Aktive User (7 Tage)" value={`${activeUsers.length} aktive Nutzer`}>
        <div className="max-h-60 overflow-y-auto">
          <ul className={listItemClass}>
            {activeUsers
              .slice()
              .sort(
                (a, b) =>
                  (parseTimestamp(b.last_active)?.getTime() || 0) -
                  (parseTimestamp(a.last_active)?.getTime() || 0)
              )
              .map((u, i) => (
              <li key={i}>
                {u.name} <span className={metaTextClass}>(aktiv am {formatDateTimeLabel(u.last_active)})</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="🧺 Entnommene Fische" value={`${takenCatches.length} Einträge`}>
        {takenCatches.length > 0 ? (
          <div className="max-h-60 overflow-y-auto">
            <ul className={listItemClass}>
              {takenCatches.map((entry, i) => (
                <li key={i}>
                  {entry.angler} – {entry.fish}
                  <span className={metaTextClass}>
                    {' am '}
                    {entry.timestamp ? formatDateTimeLabel(entry.timestamp) : 'unbekannt'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={fallbackTextClass}>Keine entnommenen Fische</div>
        )}
      </Section>

      <Section title="🌍 Externe Fänge (außer Lobberich)">
        {externalCatches.length > 0 ? (
          <div className="max-h-60 overflow-y-auto">
            <ul className={listItemClass}>
              {externalCatches.map((entry, i) => (
                <li key={i}>
                  {entry.angler} – {entry.fish} ({entry.size} cm)
                  <span className={metaTextClass}>
                    {' am '}
                    {formatDateTimeLabel(entry.timestamp)}
                    {' bei '}
                    {entry.location_name || 'unbekannt'} ({entry.lat.toFixed(4)}, {entry.lon.toFixed(4)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={fallbackTextClass}>Keine externen Fänge</div>
        )}
      </Section>

      <Section
        title="📊 Seitenaufrufe"
        value={pageViewLoading ? 'Lade…' : `${pageViewTotal} Aufrufe`}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <label className="flex items-center gap-2">
              Zeitraum
              <select
                value={pageViewRangeDays}
                onChange={(event) => setPageViewRangeDays(Number(event.target.value))}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {PAGE_VIEW_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <span>Seiten: {pageViewAggregates.length}</span>
            <span>Ø je Seite: {pageViewAverage}</span>
          </div>

          {pageViewError ? (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
              {pageViewError}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Aktivste Angler</h4>
                {pageViewLoading ? (
                  <div className={fallbackTextClass}>Lädt…</div>
                ) : pageViewTopAnglers.length === 0 ? (
                  <div className={fallbackTextClass}>Keine Aufrufe im Zeitraum.</div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        <tr>
                          <th className="px-3 py-2 text-left">Angler</th>
                          <th className="px-3 py-2 text-right">Aufrufe</th>
                          <th className="px-3 py-2 text-right">Zuletzt aktiv</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {pageViewTopAnglers.map((entry) => (
                          <tr key={entry.name} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                            <td className="px-3 py-2 text-xs sm:text-sm">{entry.name}</td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-300">{entry.total}</td>
                            <td className="px-3 py-2 text-right text-xs sm:text-sm">
                              {entry.lastSeen ? formatDateTimeLabel(entry.lastSeen) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Beliebteste Seiten</h4>
                {pageViewLoading ? (
                  <div className={fallbackTextClass}>Lädt…</div>
                ) : pageViewAggregates.length === 0 ? (
                  <div className={fallbackTextClass}>Keine Daten im Zeitraum.</div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        <tr>
                          <th className="px-3 py-2 text-left">Menüpunkt</th>
                          <th className="px-3 py-2 text-right">Aufrufe</th>
                          <th className="px-3 py-2 text-right">Unique</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {pageViewAggregates.slice(0, 20).map((row) => (
                          <tr key={row.path} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                            <td className="px-3 py-2 text-xs sm:text-sm">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-gray-800 dark:text-gray-100">{row.label}</span>
                                {row.label !== row.path && row.path && row.path !== '—' && (
                                  <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">{row.path}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-green-700 dark:text-green-300">{row.total}</td>
                            <td className="px-3 py-2 text-right">{row.uniqueAnglers}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Letzte Ereignisse</h4>
                {pageViewLoading ? (
                  <div className={fallbackTextClass}>Lädt…</div>
                ) : pageViewLastEvents.length === 0 ? (
                  <div className={fallbackTextClass}>Keine Aufrufe im Zeitraum.</div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        <tr>
                          <th className="px-3 py-2 text-left">Zeit</th>
                          <th className="px-3 py-2 text-left">Menüpunkt</th>
                          <th className="px-3 py-2 text-left">Build</th>
                          <th className="px-3 py-2 text-left">Angler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {pageViewLastEvents.map((row) => (
                          <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                            <td className="px-3 py-2 text-xs sm:text-sm">{formatDateTimeLabel(row.created_at)}</td>
                            <td className="px-3 py-2 text-xs sm:text-sm">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-gray-800 dark:text-gray-100">{row.label || '—'}</span>
                                {row.label !== row.path && row.path && row.path !== '—' && (
                                  <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">{row.path}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs sm:text-sm">
                              {row.buildDisplay || row.buildLabel ? (
                                <span
                                  className={`font-mono text-xs ${row.matchesCurrentBuild
                                    ? 'text-green-600 dark:text-green-300 font-semibold'
                                    : row.buildDisplay
                                      ? 'text-gray-800 dark:text-gray-200'
                                      : 'text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  {row.buildDisplay || row.buildLabel}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2 text-xs sm:text-sm">{row.angler || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {pageViewRows.length > pageViewLastLimit && (
                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => setPageViewLastLimit((limit) => Math.min(limit + 20, pageViewRows.length))}
                      className="inline-flex items-center justify-center rounded border border-blue-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-400/10"
                    >
                      Mehr anzeigen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Section>


      <Section title="🗓 Registrierte User" value={`${allProfiles.length} registrierte Nutzer`}>
        <div className="max-h-60 overflow-y-auto">
          <ul className={listItemClass}>
            {allProfiles.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((p, i) => (
              <li key={i}>
                {p.name} <span className={metaTextClass}>(seit {formatDateLabel(p.created_at)})</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="📣 Push-Abonnenten" value={pushSectionLabel}>
        {pushByAngler.length > 0 || pushDeviceSummary.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Angler ({anglerGroupCount})</h4>
              {pushByAngler.length > 0 ? (
                <div className="max-h-60 overflow-y-auto">
                  <ul className={listItemClass}>
                    {pushByAngler.map((entry) => (
                      <li key={entry.name}>
                        {entry.name}
                        <span className={metaTextClass}>
                          {` – ${entry.total} Gerät${entry.total !== 1 ? 'e' : ''} (${entry.active} aktiv)`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className={fallbackTextClass}>Keine Anglerdaten</div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Geräte ({deviceGroupCount})</h4>
              {pushDeviceSummary.length > 0 ? (
                <div className="max-h-60 overflow-y-auto">
                  <ul className={listItemClass}>
                    {pushDeviceSummary.map((entry) => (
                      <li key={entry.device}>
                        {entry.total}x {entry.device}
                        <span className={metaTextClass}>
                          {` (${entry.active} aktiv)`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className={fallbackTextClass}>Keine Gerätedaten</div>
              )}
            </div>
          </div>
        ) : (
          <div className={fallbackTextClass}>Keine Push-Daten</div>
        )}
      </Section>


      <Section title="🔔 OneSignal Debug">
        <OneSignalHealthCheck />
      </Section>
    </div>
  );
}
