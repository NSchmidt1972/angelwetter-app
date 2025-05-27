import { useEffect, useState } from 'react';
import WeatherNow from '../components/WeatherNow';
import { fetchWeather } from '../api/weather';

export default function Home() {
  const [weatherData, setWeatherData] = useState(null);

  useEffect(() => {
    const cached = localStorage.getItem('cachedWeather');
    let parsed = null;

    if (cached) {
      parsed = JSON.parse(cached);
      setWeatherData(parsed.data);
    }

    // Nur aktualisieren, wenn die Seite frisch geladen wurde (nicht bei internem Routing)
    const navType = performance.getEntriesByType("navigation")[0]?.type || "navigate";

    const isFullReload = navType === "reload" || navType === "navigate";

    if (isFullReload) {
      fetchWeather()
        .then((freshData) => {
          if (freshData) {
            setWeatherData(freshData);
            localStorage.setItem('cachedWeather', JSON.stringify({
              data: freshData,
              savedAt: Date.now()
            }));
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
      if (updated) {
        setWeatherData(updated);
        localStorage.setItem('cachedWeather', JSON.stringify({
          data: updated,
          savedAt: Date.now()
        }));
      }
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
