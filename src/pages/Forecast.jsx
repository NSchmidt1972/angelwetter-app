// ✅ Forecast.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function FishForecast({ fishes, currentWeather }) {
  if (!currentWeather) return <p className="text-gray-500">Keine aktuellen Wetterdaten verfügbar.</p>;

  const similar = fishes.filter(f => {
    const w = f.weather;
    if (!w) return false;
    return (
      Math.abs(w.temp - currentWeather.temp) <= 2 &&
      Math.abs(w.pressure - currentWeather.pressure) <= 5 &&
      Math.abs(w.wind - currentWeather.wind) <= 1 &&
      Math.abs(w.wind_deg - currentWeather.wind_deg) <= 45 &&
      w.description === currentWeather.description
    );
  });

  const chance = ((similar.length / fishes.length) * 100).toFixed(1);

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <p className="text-gray-800 text-lg">
        Bei vergleichbarem Wetter wurden in der Vergangenheit <span className="font-bold">{similar.length}</span> Fische gefangen.
      </p>
      <p className="mt-2 text-xl text-green-700 font-bold">
        🎯 Prognose: {chance}% Fangwahrscheinlichkeit
      </p>
    </div>
  );
}

export default function Forecast({ weatherData }) {
  const [fishes, setFishes] = useState([]);

  useEffect(() => {
    supabase.from('fishes').select('*').then(({ data, error }) => {
      if (!error) setFishes(data);
    });
  }, []);

  const currentWeather = weatherData?.current && {
    temp: weatherData.current.temp,
    pressure: weatherData.current.pressure,
    wind: weatherData.current.wind_speed,
    wind_deg: weatherData.current.wind_deg,
    description: weatherData.current.weather?.[0]?.description ?? ''
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700">🔮 Fangprognose</h2>
      <p className="text-center text-gray-600 mb-4 max-w-xl mx-auto">
        Diese Schätzung basiert auf dem aktuellen Wetter und gefangenen Fischen bei ähnlichen Bedingungen.
      </p>
      <div className="max-w-2xl mx-auto">
        <FishForecast fishes={fishes} currentWeather={currentWeather} />
      </div>
    </div>
  );
}

