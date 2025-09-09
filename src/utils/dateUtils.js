// src/utils/dateUtils.js

const DTFULL = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });
const DTDAY  = new Intl.DateTimeFormat('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export function localDayKey(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function monthKey(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
}

export function formatDateTime(d) {
  return DTFULL.format(new Date(d));
}

export function formatDayLabel(dayKeyStr) {
  const [y, m, d] = dayKeyStr.split('-').map(Number);
  return DTDAY.format(new Date(y, m - 1, d));
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}
