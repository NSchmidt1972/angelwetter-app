import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { formatNameList } from '../utils/nameFormatter';

function formatTime(iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function AdminOverview() {
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [latestCatch, setLatestCatch] = useState(null);
  const [catchCount, setCatchCount] = useState(null);
  const [nameShort, setNameShort] = useState(null);
  const [recentBlanks, setRecentBlanks] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        // Wetterzeit
        const { data: weatherData, error: weatherError } = await supabase
          .from('weather_cache')
          .select('updated_at')
          .eq('id', 'latest')
          .single();

        if (weatherError) throw weatherError;
        if (weatherData?.updated_at) {
          setWeatherUpdatedAt(
            new Date(weatherData.updated_at).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit'
            })
          );
        }

        // Aktive Nutzer
        const { data: users, error: userError } = await supabase
          .from('user_activity')
          .select('user_id, last_active')
          .gt('last_active', new Date(Date.now() - 1440 * 1440 * 1000).toISOString());

        if (userError && userError.message.includes('does not exist')) {
          console.warn('⚠️ Tabelle user_activity existiert nicht – wird übersprungen.');
        } else if (userError) {
          throw userError;
        } else {
          const userIds = users.map(u => u.user_id);

          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          if (profileError) throw profileError;

          const enrichedUsers = users
            .map(u => {
              const match = profiles.find(p => p.id === u.user_id);
              return match ? { ...u, name: match.name } : null;
            })
            .filter(Boolean);

          const formatted = formatNameList(enrichedUsers.map(u => u.name));
          const enrichedFormatted = enrichedUsers.map((u, i) => ({ ...u, displayName: formatted[i] }));
          setActiveUsers(enrichedFormatted);
        }

        // Letzter Fang
        const { data: fishes, error: fishError } = await supabase
          .from('fishes')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(1);

        if (fishError) throw fishError;
        setLatestCatch(fishes?.[0] || null);

        // Anzahl Fänge
        const { count, error: countError } = await supabase
          .from('fishes')
          .select('*', { count: 'exact', head: true })
          .not('fish', 'is', null)
          .neq('fish', '');

        if (countError) throw countError;
        if (typeof count === 'number') {
          setCatchCount(count);
        }

        // Abkürzung Name für letzten Fang
        const { data: profileList } = await supabase.from('profiles').select('name');
        if (profileList && fishes?.[0]?.angler) {
          const fullName = fishes[0].angler;
          const [first, last] = fullName.split(' ');
          const count = profileList.filter(p => p.name.startsWith(first + ' ')).length;
          const short = count > 1 && last ? `${first} ${last[0]}.` : first;
          setNameShort(short);
        }

        // Schneidertage letzte 7 Tage
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
      } catch (error) {
        console.error('❌ Fehler beim Laden der Admin-Daten:', error.message);
      }
    }

    loadData();
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white dark:bg-gray-900 shadow-md rounded-xl mt-6 text-gray-800 dark:text-gray-100">
      <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-6">🔧 Admin-Übersicht</h2>

      <ul className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <li>
          <strong>☁️ Letztes Wetterupdate:</strong> {weatherUpdatedAt || 'Lade...'}
        </li>
        <li>
          <strong>👥 Aktive Nutzer (24h):</strong> {activeUsers.length}
          {activeUsers.length > 0 && (
            <ul className="list-disc list-inside ml-4 mt-1">
              {activeUsers.map((u, i) => (
                <li key={i}>
                  {u.displayName}
                  <span className="text-gray-500 text-xs ml-2">
                    (aktiv um {formatTime(u.last_active)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
        <li>
          <strong>🎣 Gesamtanzahl Fänge:</strong> {catchCount === null ? 'Lade...' : catchCount}
        </li>
        <li>
          <strong>🐟 Letzter Fang:</strong>{' '}
          {latestCatch ? (
            <>
              {nameShort || latestCatch.angler} – {latestCatch.fish} ({latestCatch.size} cm) um{' '}
              {new Date(latestCatch.timestamp).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </>
          ) : (
            'Lade...'
          )}
        </li>
        {recentBlanks.length > 0 && (
          <li>
            <strong>❌ Schneidertage (7 Tage):</strong>
            <ul className="list-disc list-inside ml-4 mt-1">
              {recentBlanks.map((b, i) => (
                <li key={i}>
                  {b.angler} am {new Date(b.timestamp).toLocaleDateString('de-DE')} um{' '}
                  {new Date(b.timestamp).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </div>
  );
}
