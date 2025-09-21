import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import OneSignalHealthCheck from '../components/OneSignalHealthCheck';
import { formatDateOnly, formatDateTime, parseTimestamp, formatTimeOnly } from '@/utils/dateUtils';

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
          .select('name, created_at')
          .order('created_at', { ascending: false });
        setAllProfiles(allProfilesData);

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


      <Section title="❌ Letzte Schneidertage (7 Tage)">
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
          <div className={fallbackTextClass}>Keine Schneidertage</div>
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


      <Section title="🔔 OneSignal Debug">
        <OneSignalHealthCheck />
      </Section>
    </div>
  );
}
