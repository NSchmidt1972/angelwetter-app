// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import WeatherNow from '@/components/weather/WeatherNow';
import { useWeatherCache } from '@/hooks/useWeatherCache';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { Card } from '@/components/ui';
import { supabase } from '@/supabaseClient';
import { withTimeout } from '@/utils/async';
import usePageMeta from '@/hooks/usePageMeta';
import { usePermissions } from '@/permissions/usePermissions';
import { ROLES } from '@/permissions/roles';

export default function Home() {
  usePageMeta({
    title: 'Dashboard | Angelwetter',
    description: 'Angelwetter Dashboard mit aktuellen Wetterdaten, Fangübersicht und Vereinsinformationen.',
  });

  const { weather, loading, error } = useWeatherCache();
  const resumeTick = useAppResumeTick({ enabled: true });
  const { hasAtLeastRole } = usePermissions();
  const [waterTemperature, setWaterTemperature] = useState(null);
  const [waterTemperatureHistory, setWaterTemperatureHistory] = useState([]);
  const [waterTemperatureLoading, setWaterTemperatureLoading] = useState(true);
  const weatherData = weather;
  const errorMessage = error && !weatherData ? '⚠️ Wetterdaten konnten nicht geladen werden.' : null;
  const canSeeWaterTemperature = hasAtLeastRole(ROLES.ADMIN);
  useEffect(() => {
    let active = true;

    async function loadWaterTemperature() {
      if (!canSeeWaterTemperature) {
        setWaterTemperature(null);
        setWaterTemperatureHistory([]);
        setWaterTemperatureLoading(false);
        return;
      }

      setWaterTemperatureLoading(true);
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error: tempError } = await withTimeout(
          supabase
            .from('temperature_log')
            .select('temperature_c, measured_at')
            .gte('measured_at', sevenDaysAgo)
            .order('measured_at', { ascending: true }),
          10000,
          'Wassertemperatur timeout'
        );

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
  }, [weatherData?.savedAt, canSeeWaterTemperature, resumeTick]);

  return (
    <Card className="p-4 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans">
      {errorMessage && <p className="text-red-600 text-center">{errorMessage}</p>}
      {(weatherData || loading) && (
        <WeatherNow
          data={weatherData}
          loading={loading}
          waterTemperature={waterTemperature}
          waterTemperatureHistory={waterTemperatureHistory}
          waterTemperatureLoading={waterTemperatureLoading}
          showWaterTemperature={canSeeWaterTemperature}
        />
      )}
    </Card>
  );
}
