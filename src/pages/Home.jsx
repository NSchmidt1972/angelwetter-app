import WeatherNow from '../components/WeatherNow';
import { fetchWeather } from '../api/weather';
import { useState } from 'react';

export default function Home({ weatherData: initialData }) {
  const [weatherData, setWeatherData] = useState(initialData);

  const refreshWeather = () => {
    fetchWeather()
      .then(setWeatherData)
      .catch(err => {
        console.error('Fehler beim Aktualisieren des Wetters:', err);
        alert('Wetter konnte nicht aktualisiert werden.');
      });
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
