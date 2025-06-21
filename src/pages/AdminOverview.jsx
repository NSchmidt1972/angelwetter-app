// Visuell vereinheitlichte Admin-Übersicht mit Kartenoptik, Schatten, Darkmode-ready
// Einheitliche Sektionen, klare Listen, Scrollbereiche, konsistente Farben

import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import OneSignalHealthCheck from '../components/OneSignalHealthCheck';

export default function AdminOverview() {
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [latestCatch, setLatestCatch] = useState(null);
  const [catchCount, setCatchCount] = useState(null);
  const [nameShort, setNameShort] = useState(null);
  const [recentBlanks, setRecentBlanks] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: weatherData } = await supabase
          .from('weather_cache')
          .select('updated_at')
          .eq('id', 'latest')
          .single();

        if (weatherData?.updated_at) {
          setWeatherUpdatedAt(new Date(weatherData.updated_at)
            .toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
        }

        const { data: users } = await supabase
          .from('user_activity')
          .select('user_id, last_active')
          .gt('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        const userIds = users.map(u => u.user_id);
        const { data: profiles } = await supabase
          .from('profiles').select('id, name').in('id', userIds);
        const enriched = users.map(u => {
          const match = profiles.find(p => p.id === u.user_id);
          return match ? { ...u, name: match.name } : null;
        }).filter(Boolean);
        setActiveUsers(enriched);

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
          .gt('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('timestamp', { ascending: false });
        setRecentBlanks(blanks);

        const { data: allProfilesData } = await supabase
          .from('profiles')
          .select('name, created_at')
          .order('created_at', { ascending: false });
        setAllProfiles(allProfilesData);
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
                {nameShort} – {latestCatch.fish} ({latestCatch.size} cm)
                <span className={metaTextClass}> {' am '}
                  {new Date(new Date(latestCatch.timestamp).getTime() + 2 * 60 * 60 * 1000)
                    .toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
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
                    {new Date(new Date(b.timestamp).getTime() + 2 * 60 * 60 * 1000)
                      .toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
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
            {activeUsers.slice().sort((a, b) => new Date(b.last_active) - new Date(a.last_active)).map((u, i) => (
              <li key={i}>
                {u.name} <span className={metaTextClass}>(aktiv am {
                  new Date(new Date(u.last_active).getTime() + 2 * 60 * 60 * 1000)
                    .toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
                })</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="🗓 Registrierte User" value={`${allProfiles.length} registrierte Nutzer`}>
        <div className="max-h-60 overflow-y-auto">
          <ul className={listItemClass}>
            {allProfiles.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((p, i) => (
              <li key={i}>
                {p.name} <span className={metaTextClass}>(seit {new Date(p.created_at).toLocaleDateString('de-DE')})</span>
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
