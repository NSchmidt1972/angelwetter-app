// src/utils/weatherFormat.js
export const fmtC = (v) => (v == null || Number.isNaN(v) ? "—" : `${Math.round(v)}°C`);
export const fmtHpa = (v) => (v == null ? "—" : `${v} hPa`);
export const fmtPct = (v) => (v == null ? "—" : `${v}%`);
export const fmtWindMs = (v) => (v == null ? "—" : `${Number(v).toFixed(1)} m/s`);

export function degToDir(deg) {
  if (deg == null) return "—";
  const dirs = ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function fmtTime(ts, locale = "de-DE") {
  const d = new Date(ts ?? Date.now());
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export const owmIconUrl = (code) => `https://openweathermap.org/img/wn/${code}@2x.png`;
