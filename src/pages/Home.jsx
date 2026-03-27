// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import WeatherNow from '@/components/weather/WeatherNow';
import { useWeatherCache } from '@/hooks/useWeatherCache';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { Card } from '@/components/ui';
import { withTimeout } from '@/utils/async';
import usePageMeta from '@/hooks/usePageMeta';
import { useWaterTemperatureAccess } from '@/hooks/useWaterTemperatureAccess';
import { fetchWaterTemperatureHistory } from '@/services/waterTemperatureService';

export default function Home() {
  usePageMeta({
    title: 'Dashboard | Angelwetter',
    description: 'Angelwetter Dashboard mit aktuellen Wetterdaten, Fangübersicht und Vereinsinformationen.',
  });

  const { weather, loading, error } = useWeatherCache();
  const resumeTick = useAppResumeTick({ enabled: true });
  const { currentClubId, canSeeWaterTemperature } = useWaterTemperatureAccess();
  const [waterTemperature, setWaterTemperature] = useState(null);
  const [waterTemperatureHistory, setWaterTemperatureHistory] = useState([]);
  const [waterTemperatureLoading, setWaterTemperatureLoading] = useState(true);
  const weatherData = weather;
  const errorMessage = error && !weatherData ? '⚠️ Wetterdaten konnten nicht geladen werden.' : null;

  useEffect(() => {
    let active = true;

    async function loadWaterTemperature() {
      if (!canSeeWaterTemperature || !currentClubId) {
        setWaterTemperature(null);
        setWaterTemperatureHistory([]);
        setWaterTemperatureLoading(false);
        return;
      }

      setWaterTemperatureLoading(true);
      try {
        const rows = await withTimeout(
          fetchWaterTemperatureHistory({
            clubId: currentClubId,
            days: 7,
            limit: 1000,
          }),
          10000,
          'Wassertemperatur timeout'
        );

        if (!active) return;

        const history = Array.isArray(rows) ? rows : [];
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
  }, [weatherData?.savedAt, canSeeWaterTemperature, currentClubId, resumeTick]);

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
