// src/utils/formatters.js
export function renderFishRating(probability) {
  const p = Number(probability);
  if (!Number.isFinite(p)) return "❓";
  const rating = Math.max(0, Math.min(5, Math.round((p / 100) * 5)));
  return rating === 0 ? "🚫" : "🐟".repeat(rating);
}

export function formatDateFromUnix(ts) {
  const d = new Date((ts ?? 0) * 1000);
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function formatPercent(n, digits = 1) {
  return Number.isFinite(n) ? `${n.toFixed(digits)} %` : "n/a";
}

export function getPressureTrendLabel(val) {
  if (val == null) return "n/a";
  const rounded = Math.abs(val).toFixed(2);
  if (val >= 3) return `stark steigend (+${rounded} hPa)`;
  if (val >= 1) return `steigend (+${rounded} hPa)`;
  if (val >= 0.5) return `leicht steigend (+${rounded} hPa)`;
  if (val <= -3) return `stark fallend (-${rounded} hPa)`;
  if (val <= -1) return `fallend (-${rounded} hPa)`;
  if (val <= -0.5) return `leicht fallend (-${rounded} hPa)`;
  return `stabil (${val.toFixed(2)} hPa)`;
}
