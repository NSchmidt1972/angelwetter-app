// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import WeatherNow from '../components/WeatherNow';
import { fetchWeather } from '../api/weather';

export default function Home() {
  const [weatherData, setWeatherData] = useState(null);

  useEffect(() => {
    const cached = localStorage.getItem('cachedWeather');
    if (cached) {
      const parsed = JSON.parse(cached);
      setWeatherData(parsed); // enthält: { data, savedAt }
    }

    const navType = performance.getEntriesByType("navigation")[0]?.type || "navigate";
    const isFullReload = navType === "reload" || navType === "navigate";

    if (isFullReload) {
      fetchWeather()
        .then((freshData) => {
          if (freshData) {
            const combined = {
              data: freshData,
              savedAt: Date.now()
            };
            setWeatherData(combined);
            localStorage.setItem('cachedWeather', JSON.stringify(combined));
          }
        })
        .catch(err =>
          console.error('Fehler beim automatischen Wetter-Update:', err)
        );
    }
  }, []);

  const refreshWeather = async () => {
    try {
      const updated = await fetchWeather();
      const combined = {
        data: updated,
        savedAt: Date.now()
      };
      setWeatherData(combined);
      localStorage.setItem('cachedWeather', JSON.stringify(combined));
    } catch (err) {
      console.error('Fehler beim manuellen Wetter-Update:', err);
      alert('Wetter konnte nicht aktualisiert werden.');
    }
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      {!weatherData ? (
        <p className="text-gray-500 text-center">Lade Wetterdaten…</p>
      ) : (
        <WeatherNow data={weatherData} onRefresh={refreshWeather} />
      )}
    </div>
  );
}
