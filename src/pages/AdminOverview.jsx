import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { formatNameList } from '../utils/nameFormatter';

export default function AdminOverview() {
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [latestCatch, setLatestCatch] = useState(null);
  const [catchCount, setCatchCount] = useState(null);
  const [nameShort, setNameShort] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: weatherData,
          error: weatherError
        } = await supabase
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

        const {
          data: users,
          error: userError
        } = await supabase
          .from('user_activity')
          .select('user_id, last_active')
          .gt('last_active', new Date(Date.now() - 60 * 60 * 1000).toISOString());

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

          const enrichedUsers = users.map(u => {
            const match = profiles.find(p => p.id === u.user_id);
            return {
              ...u,
              name: match?.name || u.user_id
            };
          });

          const formatted = formatNameList(enrichedUsers.map(u => u.name));
          const enrichedFormatted = enrichedUsers.map((u, i) => ({ ...u, displayName: formatted[i] }));
          setActiveUsers(enrichedFormatted);
        }

        const {
          data: fishes,
          error: fishError
        } = await supabase
          .from('fishes')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(1);

        if (fishError) throw fishError;
        setLatestCatch(fishes?.[0] || null);

        const { count, error: countError } = await supabase
          .from('fishes')
          .select('*', { count: 'exact', head: true })
          .not('fish', 'is', null)
          .neq('fish', '');

        if (countError) throw countError;
        if (typeof count === 'number') {
          setCatchCount(count);
        }

        const { data: profileList } = await supabase.from('profiles').select('name');
        if (profileList && fishes?.[0]?.angler) {
          const fullName = fishes[0].angler;
          const [first, last] = fullName.split(' ');
          const count = profileList.filter(p => p.name.startsWith(first + ' ')).length;
          const short = count > 1 && last ? `${first} ${last[0]}.` : first;
          setNameShort(short);
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
          <strong>👥 Aktive Nutzer (letzte Stunde):</strong> {activeUsers.length}
          {activeUsers.length > 0 && (
            <ul className="list-disc list-inside ml-4 mt-1">
              {activeUsers.map((u, i) => (
                <li key={i}>{u.displayName}</li>
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
      </ul>
    </div>
  );
}