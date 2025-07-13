// src/api/weather.js
import axios from 'axios';

const PRIMARY_API_KEY = 'd3c23b87f2fb786d00983b188a7dd0ee';
const SECONDARY_API_KEY = '8ce80976149b197e55078eac2d6cd0c8';

const DEFAULT_LAT = 51.3135;
const DEFAULT_LON = 6.256;

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => v * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const createUrl = (lat, lon, apiKey) =>
  `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=de`;

export const fetchWeather = async (userCoords = null) => {
  let lat = DEFAULT_LAT;
  let lon = DEFAULT_LON;

  if (userCoords?.lat != null && userCoords?.lon != null) {
    const dist = getDistanceKm(userCoords.lat, userCoords.lon, DEFAULT_LAT, DEFAULT_LON);
    if (dist > 1.0) {
      lat = userCoords.lat;
      lon = userCoords.lon;
    }
  }

  try {
    const url = createUrl(lat, lon, PRIMARY_API_KEY);
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.warn('⚠️ Primäre API fehlgeschlagen:', error.message);
    try {
      const fallbackUrl = createUrl(lat, lon, SECONDARY_API_KEY);
      const response = await axios.get(fallbackUrl);
      return response.data;
    } catch (fallbackError) {
      console.error('❌ Auch sekundäre API fehlgeschlagen:', fallbackError.message);
      throw fallbackError;
    }
  }
};
