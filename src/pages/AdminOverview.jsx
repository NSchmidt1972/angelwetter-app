import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { formatNameList } from '../utils/nameFormatter';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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
        // Wetterzeit
        const { data: weatherData, error: weatherError } = await supabase
          .from('weather_cache').select('updated_at').eq('id', 'latest').single();
        if (weatherError) throw weatherError;
        if (weatherData?.updated_at) {
          setWeatherUpdatedAt(new Date(weatherData.updated_at)
            .toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
        }

        // Aktive Nutzer der letzten 7 Tage
        const { data: users, error: userError } = await supabase
          .from('user_activity')
          .select('user_id, last_active')
          .gt('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        if (userError && userError.message.includes('does not exist')) {
          console.warn('⚠️ Tabelle user_activity existiert nicht – wird übersprungen.');
        } else if (userError) {
          throw userError;
        } else {
          const userIds = users.map(u => u.user_id);
          const { data: profiles, error: profileError } = await supabase
            .from('profiles').select('id, name').in('id', userIds);
          if (profileError) throw profileError;

          const enriched = users
            .map(u => {
              const match = profiles.find(p => p.id === u.user_id);
              if (!match) return null;
              return { ...u, name: match.name };
            })
            .filter(Boolean);
          const names = formatNameList(enriched.map(u => u.name));
          setActiveUsers(enriched.map((u, i) => ({
            ...u, displayName: names[i]
          })));
        }

        // Letzter Fang
        const { data: fishes, error: fishError } = await supabase
          .from('fishes').select('*').order('timestamp', { ascending: false }).limit(1);
        if (fishError) throw fishError;
        setLatestCatch(fishes?.[0] || null);

        // Anzahl Fänge
        const { count, error: countError } = await supabase
          .from('fishes')
          .select('*', { count: 'exact', head: true })
          .not('fish', 'is', null)
          .neq('fish', '');
        if (countError) throw countError;
        if (typeof count === 'number') setCatchCount(count);

        // Abkürzung Name
        const { data: profileList } = await supabase.from('profiles').select('name');
        if (profileList && fishes?.[0]?.angler) {
          const fullName = fishes[0].angler;
          const [first, last] = fullName.split(' ');
          const duplicates = profileList.filter(p => p.name.startsWith(first + ' ')).length;
          setNameShort(duplicates > 1 && last ? `${first} ${last[0]}.` : first);
        }

        // Schneidertage
        const { data: blanks, error: blankError } = await supabase
          .from('fishes')
          .select('angler, timestamp')
          .eq('blank', true)
          .gt('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('timestamp', { ascending: false });
        if (blankError) {
          console.error('❌ Fehler beim Laden der Schneidertage:', blankError);
        } else {
          setRecentBlanks(blanks);
        }

        // Alle registrierten Mitglieder
        const { data: allProfilesData, error: allProfilesError } = await supabase
          .from('profiles').select('name, created_at').order('created_at', { ascending: false });
        if (allProfilesError) console.error('❌ Fehler beim Laden der Profile:', allProfilesError);
        else setAllProfiles(allProfilesData);

      } catch (error) {
        console.error('❌ Fehler beim Laden der Admin-Daten:', error.message);
      }
    }
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white dark:bg-gray-900 shadow-md rounded-xl mt-6 text-gray-800 dark:text-gray-100">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-6">
        🔧 Admin‑Übersicht
      </h2>

      <ul className="space-y-6 text-sm text-gray-700 dark:text-gray-300">
        {/* 1. Letztes Wetterupdate */}
        <li>
          <strong>☁️ Letzte Wetteraktualisierung:</strong>{' '}
          {weatherUpdatedAt || 'Lade...'}
        </li>

        {/* 2. Gesamtanzahl Fänge */}
        <li>
          <strong>🎣 Gesamtanzahl Fänge:</strong>{' '}
          {catchCount === null ? 'Lade...' : catchCount}
        </li>

        {/* 3. Letzter Fang (7 Tage) */}
        <li>
          <strong>🐟 Letzter Fang (7 Tage):</strong>{' '}
          {latestCatch ? (
            <>
              {nameShort || latestCatch.angler} – {latestCatch.fish} (
              {latestCatch.size} cm) am{' '}
              {new Date(latestCatch.timestamp)
                .toLocaleDateString('de-DE')}{' '}
              um{' '}
              {new Date(latestCatch.timestamp)
                .toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
            </>
          ) : (
            'Keine Daten'
          )}
        </li>

        {/* 4. Letzter Schneidertag (7 Tage) */}
        <li>
          <strong>❌ Letzter Schneidertag (7 Tage):</strong>{' '}
          {recentBlanks.length > 0 ? (
            <ul className="list-disc list-inside ml-4 mt-1">
              {recentBlanks
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 1)
                .map((b, i) => (
                  <li key={i}>
                    {b.angler} am{' '}
                    {new Date(b.timestamp)
                      .toLocaleDateString('de-DE')} um{' '}
                    {new Date(b.timestamp)
                      .toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                  </li>
                ))}
            </ul>
          ) : (
            'Keine Schneidertage'
          )}
        </li>

        {/* 5. Aktive User (7 Tage) */}
        <li>
          <strong>👥 Aktive User (7 Tage):</strong>{' '}
          {activeUsers.length}
          <ul className="list-disc list-inside ml-4 mt-1">
            {activeUsers
              .filter(u => u.last_active)
              .sort((a, b) => new Date(b.last_active) - new Date(a.last_active))
              .map((u, i) => {
                const raw = new Date(u.last_active);
                const corrected = new Date(raw.getTime() + 2 * 60 * 60 * 1000);
                const display = isNaN(corrected)
                  ? 'Ungültiges Datum'
                  : corrected.toLocaleString('de-DE', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    });
                return (
                  <li key={i}>
                    {u.displayName}
                    <span className="text-gray-500 text-xs ml-2">
                      (aktiv am {display})
                    </span>
                  </li>
                );
              })}
          </ul>
        </li>

        {/* 6. Registrierte User */}
        <li>
          <strong>🗓 Registrierte User:</strong>
          {allProfiles.length > 0 && (
            <ul className="list-disc list-inside ml-4 mt-1">
              {allProfiles.map((p, i) => (
                <li key={i}>
                  {p.name}
                  <span className="text-gray-500 text-xs ml-2">
                    (registriert am{' '}
                    {new Date(p.created_at).toLocaleDateString('de-DE')})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>
    </div>
  );
}
