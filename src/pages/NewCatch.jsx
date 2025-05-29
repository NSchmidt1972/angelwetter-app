import { useEffect, useState } from 'react';
import { fetchWeather } from '../api/weather';
import FishCatchForm from '../components/FishCatchForm';

export default function NewCatch() {
  const [weatherData, setWeatherData] = useState(null);

  useEffect(() => {
    fetchWeather().then(setWeatherData);
  }, []);

  return (
    <div className="p-4 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      <FishCatchForm weatherData={weatherData} />
    </div>
  );
}
