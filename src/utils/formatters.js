// src/utils/formatters.js

// ---------- Bestehende Helfer (unverändert) ----------
export function renderFishRating(probability) {
  const p = Number(probability);
  if (!Number.isFinite(p)) return "❓";
  const rating = Math.max(0, Math.min(5, Math.round((p / 100) * 5)));
  return rating === 0 ? "🚫" : "🐟".repeat(rating);
}

export function formatPercent(n, digits = 1) {
  return Number.isFinite(n) ? `${n.toFixed(digits)} %` : "n/a";
}

function normalizePressureTrendHpaPerDay(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  let trend = n;
  // Fallback für Altwerte in Pa/Tag statt hPa/Tag.
  if (Math.abs(trend) > 120) trend = trend / 100;
  // Physikalisch extrem unwahrscheinliche Ausreißer ausblenden.
  if (Math.abs(trend) > 25) return null;
  return trend;
}

export function getPressureTrendLabel(val) {
  const trend = normalizePressureTrendHpaPerDay(val);
  if (trend == null) return "n/a";
  const rounded = Math.abs(trend).toFixed(2);
  if (trend >= 3) return `stark steigend (+${rounded} hPa)`;
  if (trend >= 1) return `steigend (+${rounded} hPa)`;
  if (trend >= 0.5) return `leicht steigend (+${rounded} hPa)`;
  if (trend <= -3) return `stark fallend (-${rounded} hPa)`;
  if (trend <= -1) return `fallend (-${rounded} hPa)`;
  if (trend <= -0.5) return `leicht fallend (-${rounded} hPa)`;
  return `stabil (${trend.toFixed(2)} hPa)`;
}

// ---------- NEU: Einheitliche deutsche Datum-/Zeit-Formatter ----------
// Tipp: Einmal erzeugen und wiederverwenden (Performance, Konsistenz)
const FMT_DATE = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FMT_DATE_TIME = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const FMT_DAY_LABEL = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const FMT_TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

const FMT_DAY_SHORT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

// Allgemeine Formatter
export function formatDateDE(input) {
  return FMT_DATE.format(new Date(input));
}

export function formatDateTimeDE(input) {
  return FMT_DATE_TIME.format(new Date(input));
}

export function formatDayLabelDE(input) {
  return FMT_DAY_LABEL.format(new Date(input));
}

export function formatTimeDE(input) {
  return FMT_TIME.format(new Date(input));
}

// Kurzform „Mi, 04.09“
export function formatDayShortDE(input) {
  return FMT_DAY_SHORT.format(new Date(input));
}

// Bestehende Unix-Variante jetzt konsistent mit obiger Kurzform
export function formatDateFromUnix(ts) {
  const ms = (ts ?? 0) * 1000;
  return FMT_DAY_SHORT.format(new Date(ms));
}
