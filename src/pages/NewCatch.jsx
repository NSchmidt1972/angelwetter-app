import { useEffect } from 'react';
import { fetchWeather } from '../api/weather';
import FishCatchForm from '../components/FishCatchForm';

export default function NewCatch({ weatherData, setWeatherData }) {
  useEffect(() => {
    if (!weatherData) {
      fetchWeather().then(data => setWeatherData({ data, savedAt: Date.now() }));
    }
  }, [weatherData, setWeatherData]);

  return (
    <div className="p-4 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      <FishCatchForm setWeatherData={setWeatherData} />
    </div>
  );
}
