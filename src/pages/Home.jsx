import { useEffect, useState, useCallback } from 'react';
import WeatherNow from '../components/WeatherNow';
import { supabase } from '../supabaseClient';

export default function Home() {
  const [weatherData, setWeatherData] = useState(null);
  const [error, setError] = useState(null);

  const loadWeatherFromSupabase = async () => {
    const { data, error } = await supabase
      .from('weather_cache')
      .select('data, updated_at')
      .eq('id', 'latest')
      .single();

    if (error || !data) {
      console.error('Fehler beim Laden der Wetterdaten:', error);
      setError('⚠️ Wetterdaten konnten nicht geladen werden.');
      return;
    }

    setWeatherData({
      data: data.data,
      savedAt: new Date(data.updated_at).getTime()
    });
    setError(null);
  };

  useEffect(() => {
    loadWeatherFromSupabase();
  }, []);

  const handleRefresh = useCallback(() => {
    loadWeatherFromSupabase();
  }, []);

  return (
    <div className="p-4 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans">
      {!weatherData && !error && (
        <p className="text-gray-500 dark:text-gray-400 text-center">Lade Wetterdaten…</p>
      )}
      {error && (
        <p className="text-red-600 text-center">{error}</p>
      )}
      {weatherData && (
        <WeatherNow data={weatherData} onRefresh={handleRefresh} />
      )}
    </div>
  );
}
