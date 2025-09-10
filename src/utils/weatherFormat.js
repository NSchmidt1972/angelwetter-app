// src/utils/weatherFormat.js
export const owmIconUrl = (code) => `https://openweathermap.org/img/wn/${code}@2x.png`;

export function degToDir(deg) {
  if (deg == null) return '—';
  const dirs = ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function weekdayShort(ts) {
  return new Date(ts * 1000).toLocaleDateString('de-DE', { weekday: 'short' });
}

export function hour2(ts) {
  return new Date(ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit' });
}

export function moonPhaseText(phase) {
  if (phase === 0 || phase === 1) return '🌑 Neumond';
  if (phase > 0 && phase < 0.25) return '🌒 Zunehmender Sichelmond';
  if (phase === 0.25) return '🌓 Erstes Viertel';
  if (phase > 0.25 && phase < 0.5) return '🌔 Zunehmender Dreiviertelmond';
  if (phase === 0.5) return '🌕 Vollmond';
  if (phase > 0.5 && phase < 0.75) return '🌖 Abnehmender Dreiviertelmond';
  if (phase === 0.75) return '🌗 Letztes Viertel';
  if (phase > 0.75 && phase < 1) return '🌘 Abnehmender Sichelmond';
  return '❓ Unbekannt';
}
