// src/api/weather.js
import axios from 'axios';

const PRIMARY_API_KEY = 'd3c23b87f2fb786d00983b188a7dd0ee';
const SECONDARY_API_KEY = '8ce80976149b197e55078eac2d6cd0c8';
const LAT = 51.3135;
const LON = 6.256;

const createUrl = (apiKey) =>
  `https://api.openweathermap.org/data/3.0/onecall?lat=${LAT}&lon=${LON}&appid=${apiKey}&units=metric&lang=de`;

export const fetchWeather = async () => {
  try {
    const url = createUrl(PRIMARY_API_KEY);
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.warn('⚠️ Primäre API fehlgeschlagen, versuche alternative API:', error.message);
    try {
      const fallbackUrl = createUrl(SECONDARY_API_KEY);
      const response = await axios.get(fallbackUrl);
      return response.data;
    } catch (fallbackError) {
      console.error('❌ Auch sekundäre API fehlgeschlagen:', fallbackError.message);
      throw fallbackError; // Optional: an UI-Komponenten weiterleiten
    }
  }
};
