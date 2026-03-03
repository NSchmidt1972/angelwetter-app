// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import WeatherNow from '@/components/weather/WeatherNow';
import { useWeatherCache } from '@/hooks/useWeatherCache';
import { useUserProfile } from '@/AuthContext';
import { Card } from '@/components/ui';
import { supabase } from '@/supabaseClient';

export default function Home() {
  const { weather, loading, error, refresh } = useWeatherCache();
  const { profile } = useUserProfile();
  const [waterTemperature, setWaterTemperature] = useState(null);
  const [waterTemperatureHistory, setWaterTemperatureHistory] = useState([]);
  const [waterTemperatureLoading, setWaterTemperatureLoading] = useState(true);
  const weatherData = weather;
  const errorMessage = error ? '⚠️ Wetterdaten konnten nicht geladen werden.' : null;
  const role = profile?.role ? String(profile.role).trim().toLowerCase() : null;
  const isAdmin = role === 'admin';

  useEffect(() => {
    let active = true;

    async function loadWaterTemperature() {
      if (!isAdmin) {
        setWaterTemperature(null);
        setWaterTemperatureHistory([]);
        setWaterTemperatureLoading(false);
        return;
      }

      setWaterTemperatureLoading(true);
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error: tempError } = await supabase
          .from('temperature_log')
          .select('temperature_c, measured_at')
          .gte('measured_at', sevenDaysAgo)
          .order('measured_at', { ascending: true });

        if (!active) return;

        if (tempError) throw tempError;
        const history = Array.isArray(data) ? data : [];
        setWaterTemperatureHistory(history);
        setWaterTemperature(history.length ? history[history.length - 1] : null);
      } catch (tempError) {
        if (!active) return;
        setWaterTemperature(null);
        setWaterTemperatureHistory([]);
        console.warn('Wassertemperatur konnte nicht geladen werden:', tempError?.message || tempError);
      } finally {
        if (active) setWaterTemperatureLoading(false);
      }
    }

    loadWaterTemperature();
    return () => {
      active = false;
    };
  }, [weatherData?.savedAt, isAdmin]);

  return (
    <Card className="p-4 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans">
      {errorMessage && <p className="text-red-600 text-center">{errorMessage}</p>}
      {(weatherData || loading) && (
        <WeatherNow
          data={weatherData}
          loading={loading}
          onRefresh={() => refresh()}
          waterTemperature={waterTemperature}
          waterTemperatureHistory={waterTemperatureHistory}
          waterTemperatureLoading={waterTemperatureLoading}
          showWaterTemperature={isAdmin}
        />
      )}
    </Card>
  );
}
