// utils/weather.js
import { fetchWeather } from '../api/weather';
import { getDistanceKm } from '../utils/geo';

export async function loadWeatherForPosition(position, fallbackCoords, onWeatherUpdate) {
  let useCoords = null;
  if (position?.lat != null && position?.lon != null) {
    const distance = getDistanceKm(position.lat, position.lon, fallbackCoords.lat, fallbackCoords.lon);
    if (distance > 1.0) {
      useCoords = position;
    }
  }

  const data = await fetchWeather(useCoords);
  const weather = {
    temp: data.current.temp ?? null,
    description: data.current.weather?.[0]?.description ?? '',
    icon: data.current.weather?.[0]?.icon ?? '',
    wind: data.current.wind_speed ?? null,
    wind_deg: data.current.wind_deg ?? null,
    humidity: data.current.humidity ?? null,
    pressure: data.current.pressure ?? null,
    moon_phase: data.daily?.[0]?.moon_phase ?? null
  };

  if (onWeatherUpdate) {
    onWeatherUpdate({ data, savedAt: Date.now() });
  }

  return weather;
}
