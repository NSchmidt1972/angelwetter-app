import { PLACE_ALIASES } from './constants';
import {
  formatDateDE,
  formatDateTimeDE,
  formatDayShortDE,
  formatTimeDE,
} from '../../utils/formatters';

export function normalizePlace(fish) {
  const raw = (fish?.location_name ?? '').toString().trim();
  if (!raw) return 'Ferkensbruch';
  for (const [regex, name] of PLACE_ALIASES) {
    if (regex.test(raw)) return name;
  }
  return raw.replace(/\s+/g, ' ');
}

export function ucfirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getWeatherDescription(fish, fallbackLower) {
  const candidates = [];
  const pushStr = (val) => {
    if (typeof val === 'string' && val.trim()) candidates.push(val.trim());
  };

  pushStr(fish?.weather_description);
  pushStr(fish?.weather_desc);
  pushStr(fish?.weatherText);
  pushStr(fish?.conditions);

  if (typeof fish?.weather === 'string') {
    pushStr(fish.weather);
  } else if (fish?.weather && typeof fish.weather === 'object') {
    pushStr(fish.weather.description);
    pushStr(fish.weather.summary);
    pushStr(fish.weather.text);
    pushStr(fish.weather?.weather?.[0]?.description);
    pushStr(fish.weather?.weather?.[0]?.main);
    pushStr(fish.weather?.current?.weather?.[0]?.description);
    pushStr(fish.weather?.current?.weather?.[0]?.main);
  }

  if (candidates.length > 0) return ucfirst(candidates[0]);
  if (typeof fallbackLower === 'string' && fallbackLower.trim()) return ucfirst(fallbackLower.trim());
  return null;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function formatDateSafe(value, fallback = 'Datum unbekannt') {
  const date = toDate(value);
  return date ? formatDateDE(date) : fallback;
}

export function formatDateTimeSafe(value, fallback = 'Datum unbekannt') {
  const date = toDate(value);
  return date ? formatDateTimeDE(date) : fallback;
}

export function formatTimeSafe(value, fallback = '–') {
  const date = toDate(value);
  return date ? formatTimeDE(date) : fallback;
}

export function formatDayShortSafe(value, fallback = '–') {
  const date = toDate(value);
  return date ? formatDayShortDE(date) : fallback;
}
