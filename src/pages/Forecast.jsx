import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PUBLIC_FROM = new Date('2025-05-29');

function isWeatherSimilar(w, current, timestamp) {
  const fangDatum = new Date(timestamp);

  const basicMatch =
    Math.abs(w.temp - current.temp) <= 10 &&
    Math.abs(w.pressure - current.pressure) <= 10 &&
    Math.abs(w.humidity - current.humidity) <= 25 &&
    Math.abs(w.wind_deg - current.wind_deg) <= 45;

  if (fangDatum < PUBLIC_FROM) {
    return basicMatch; // vor dem Stichtag: wind kann fehlen
  } else {
    return basicMatch &&
      typeof w.wind === 'number' &&
      Math.abs(w.wind - current.wind) <= 3;
  }
}

function FishForecast({ fishes, currentWeather }) {
  if (!currentWeather) {
    return <p className="text-gray-500 dark:text-gray-400">Keine aktuellen Wetterdaten verfügbar.</p>;
  }

  const fishesWithWeather = fishes.filter(f =>
    f.weather &&
    f.fish &&
    typeof f.fish === 'string' &&
    f.fish.trim() !== ''
  );

  const similar = fishesWithWeather.filter(f => isWeatherSimilar(f.weather, currentWeather, f.timestamp));

  const chance =
    fishesWithWeather.length > 0
      ? ((similar.length / fishesWithWeather.length) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
      <p className="text-gray-800 dark:text-gray-100 text-lg">
        Bei vergleichbarem Wetter wurden in der Vergangenheit <span className="font-bold">{similar.length}</span> Fische gefangen.
      </p>
      {fishesWithWeather.length === 0 ? (
        <p className="mt-2 text-gray-500 dark:text-gray-400 italic">
          Es liegen noch keine Fänge mit Wetterdaten vor.
        </p>
      ) : (
        <p className="mt-2 text-xl text-green-700 dark:text-green-400 font-bold">
          🎯 Prognose: {chance}% Fangwahrscheinlichkeit
        </p>
      )}
    </div>
  );
}

export default function Forecast() {
  const [fishes, setFishes] = useState([]);
  const [weatherData, setWeatherData] = useState(null);

  useEffect(() => {
    const loadWeatherAndFishes = async () => {
      const { data: weatherRow, error: weatherError } = await supabase
        .from('weather_cache')
        .select('data')
        .eq('id', 'latest')
        .single();

      if (weatherError || !weatherRow) {
        console.warn("⚠️ Wetterdaten konnten nicht geladen werden:", weatherError);
        return;
      }

      const current = weatherRow.data?.current;
      if (!current) return;

      const weather = {
        temp: current.temp,
        pressure: current.pressure,
        wind: current.wind_speed,
        humidity: current.humidity,
        wind_deg: current.wind_deg,
        description: current.weather?.[0]?.description ?? ''
      };

      setWeatherData(weather);

      const { data: catchData, error: catchError } = await supabase
        .from('fishes')
        .select('*');

      if (catchError) {
        console.error("❌ Fehler beim Laden der Fänge:", catchError);
      } else {
        setFishes(catchData);
      }
    };

    loadWeatherAndFishes();
  }, []);

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">🔮 Fangprognose</h2>
      <p className="text-center text-gray-600 dark:text-gray-300 mb-4 max-w-xl mx-auto">
        Diese Schätzung basiert auf dem aktuellen Wetter und gefangenen Fischen bei ähnlichen Bedingungen. Umso mehr Eintragungen, umso genauer wird die Prognose. 👀
      </p>
      <div className="max-w-2xl mx-auto">
        <FishForecast fishes={fishes} currentWeather={weatherData} />
      </div>
    </div>
  );
}
