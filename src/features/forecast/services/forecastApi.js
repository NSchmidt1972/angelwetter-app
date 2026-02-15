import { predictBatch, predictForWeather } from '@/services/aiService';
import { getLatestWeather } from '@/services/weatherService';

export async function getLatestForecastWeather() {
  return getLatestWeather();
}

export async function predictForecastForWeather(weather, options = {}) {
  return predictForWeather(weather, options);
}

export async function predictForecastBatch(weathers, options = {}) {
  return predictBatch(weathers, options);
}
