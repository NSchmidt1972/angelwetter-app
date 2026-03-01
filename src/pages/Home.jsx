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
        setWaterTemperatureLoading(false);
        return;
      }

      setWaterTemperatureLoading(true);
      try {
        const { data, error: tempError } = await supabase
          .from('temperature_log')
          .select('temperature_c, measured_at')
          .order('measured_at', { ascending: false })
          .limit(1);

        if (!active) return;

        if (tempError) throw tempError;
        setWaterTemperature(Array.isArray(data) ? data[0] || null : null);
      } catch (tempError) {
        if (!active) return;
        setWaterTemperature(null);
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
          waterTemperatureLoading={waterTemperatureLoading}
          showWaterTemperature={isAdmin}
        />
      )}
    </Card>
  );
}
