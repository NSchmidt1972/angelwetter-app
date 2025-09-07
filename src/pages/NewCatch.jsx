// src/pages/NewCatch.jsx
import { useEffect } from 'react';
import { fetchWeather } from '../api/weather';
import FishCatchForm from '../components/FishCatchForm';

export default function NewCatch({
  anglerName,               // ✅ optional: falls du den Namen im Formular brauchst
  weatherData,
  setWeatherData,
  showEffect,               // ✅ neu: für Achievement-Toast/Konfetti
}) {
  useEffect(() => {
    if (!weatherData) {
      fetchWeather()
        .then((data) => setWeatherData?.({ data, savedAt: Date.now() }))
        .catch((err) => console.warn('⚠️ fetchWeather fehlgeschlagen:', err));
    }
  }, [weatherData, setWeatherData]);

  return (
    <div className="p-4 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      <FishCatchForm
        anglerName={anglerName}
        weatherData={weatherData}
        setWeatherData={setWeatherData}
        showEffect={showEffect}     // ✅ wichtig: Achievements nach dem Speichern anzeigen
      />
    </div>
  );
}
