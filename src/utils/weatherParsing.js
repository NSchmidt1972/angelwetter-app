// src/utils/weatherParsing.js

export const RAIN_REGEX  = /(regen|regenschauer|niesel|sprühregen|schauer|rain|drizzle|shower)/i;
export const SUNNY_REGEX = /(klarer himmel|wolkenlos|heiter|clear sky|sunny|sonnig)/i;

/**
 * Normalisiert Wetterdaten aus unterschiedlichen Strukturen.
 * Liefert: { textLower, moonPhase, tempC, rainMm, windSpeed, windGust }
 */
export function parseWeather(f) {
  let w = f?.weather ?? null;

  // Direkte Temperaturfelder erlauben
  if (typeof f?.temperature === 'number') w = { current: { temp: f.temperature } };
  if (typeof f?.temp === 'number')        w = { current: { temp: f.temp } };

  // String → JSON versuchen
  if (typeof w === 'string') { try { w = JSON.parse(w); } catch { /* noop */ } }
  if (!w || typeof w !== 'object') w = {};

  const parts = [];
  const take = (v) => { if (v != null && String(v).trim()) parts.push(String(v).toLowerCase()); };

  // bekannte Textfelder
  const direct = f.weather_description ?? f.weather_desc ?? f.weatherText ?? f.conditions ?? null;
  if (typeof direct === 'string' && direct.trim()) parts.push(direct.toLowerCase());
  take(w?.weather?.[0]?.description || w?.weather?.[0]?.main);
  take(w?.current?.weather?.[0]?.description || w?.current?.weather?.[0]?.main);
  take(w.description); take(w.summary); take(w.text);
  const icon = w?.weather?.[0]?.icon || w?.current?.weather?.[0]?.icon;
  if (icon === '01d') parts.push('clear sky');

  // Temperatur-Kandidaten
  const cand = [];
  const pushNum = (v) => { const n = Number(v); if (!Number.isNaN(n)) cand.push(n); };
  pushNum(w?.current?.temp);
  pushNum(w?.temp);
  pushNum(w?.main?.temp);
  pushNum(w?.hourly?.[0]?.temp);
  pushNum(w?.daily?.[0]?.temp?.day);

  let t = cand.sort((a, b) => a - b)[Math.floor(cand.length / 2)];
  if (t != null) {
    if (t > 80) t = t - 273.15;                // Kelvin → °C
    else if (t > 45 && t < 120) t = (t - 32) * (5 / 9); // Fahrenheit → °C
  }

  // Mondphase
  let moon = null;
  if (typeof w.moon_phase === 'number') moon = w.moon_phase;
  else if (typeof w?.current?.moon_phase === 'number') moon = w.current.moon_phase;
  else if (Array.isArray(w?.daily) && typeof w.daily[0]?.moon_phase === 'number') moon = w.daily[0].moon_phase;
  else if (typeof w?.moon?.phase !== 'undefined') {
    const p = parseFloat(w?.moon?.phase); moon = Number.isNaN(p) ? null : p;
  }

  // Niederschlagsmengen (mm) – größtes Signal nehmen
  const nums = [
    w?.rain?.['1h'], w?.rain?.['3h'],
    w?.current?.rain?.['1h'], w?.current?.rain?.['3h'],
    w?.precipitation, w?.current?.precipitation,
    w?.snow?.['1h'], w?.snow?.['3h'],
  ].map(Number).filter((n) => !Number.isNaN(n));
  const rainMm = nums.length ? Math.max(...nums) : null;

  // Windgeschwindigkeit (m/s) & Böen – höchste Werte bevorzugen
  const winds = [];
  const gusts = [];
  const pushWind = (val, target = winds) => {
    const n = Number(val);
    if (!Number.isNaN(n) && Number.isFinite(n)) target.push(n);
  };

  pushWind(w?.wind);
  pushWind(w?.wind_speed);
  pushWind(w?.windSpeed);
  pushWind(w?.wind?.speed);
  pushWind(w?.current?.wind_speed);
  pushWind(w?.current?.wind?.speed);
  pushWind(w?.hourly?.[0]?.wind_speed);
  pushWind(w?.hourly?.[0]?.wind);
  pushWind(w?.daily?.[0]?.wind_speed);
  pushWind(w?.daily?.[0]?.wind);
  pushWind(f?.wind);
  pushWind(f?.wind_speed);
  pushWind(f?.windSpeed);

  pushWind(w?.wind_gust, gusts);
  pushWind(w?.current?.wind_gust, gusts);
  pushWind(w?.wind?.gust, gusts);
  pushWind(w?.hourly?.[0]?.wind_gust, gusts);
  pushWind(w?.daily?.[0]?.wind_gust, gusts);
  pushWind(f?.wind_gust, gusts);
  pushWind(f?.windGust, gusts);

  const windSpeed = winds.length ? Math.max(...winds) : null;
  const windGust = gusts.length ? Math.max(...gusts) : null;

  return {
    textLower: parts.join(' '),
    moonPhase: moon ?? null,
    tempC: (typeof t === 'number' ? t : null),
    rainMm,
    windSpeed,
    windGust,
  };
}

export function isRainyCatch(f) {
  const p = parseWeather(f);
  return (p.textLower && RAIN_REGEX.test(p.textLower)) || (p.rainMm != null && p.rainMm > 0);
}

export function isSunnyCatch(f) {
  const p = parseWeather(f);
  return !!p.textLower && SUNNY_REGEX.test(p.textLower);
}

export const extractTempC      = (f) => parseWeather(f).tempC;
export const extractMoonPhase  = (f) => parseWeather(f).moonPhase;
