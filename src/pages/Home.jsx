// src/pages/Home.jsx
import WeatherNow from '@/components/weather/WeatherNow';
import { useWeatherCache } from '@/hooks/useWeatherCache';

export default function Home() {
  const { weather, loading, error, refresh } = useWeatherCache();
  const weatherData = weather;
  const errorMessage = error ? '⚠️ Wetterdaten konnten nicht geladen werden.' : null;

  return (
    <div className="p-4 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans">
      {errorMessage && <p className="text-red-600 text-center">{errorMessage}</p>}
      {(weatherData || loading) && (
        <WeatherNow data={weatherData} loading={loading} onRefresh={() => refresh()} />
      )}
    </div>
  );
}
