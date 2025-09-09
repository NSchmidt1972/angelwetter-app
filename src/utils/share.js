// src/utils/share.js
import { getMoonDescription, windDirection } from './weather';

const FISH_ARTICLES = { Aal:'einen', Barsch:'einen', Brasse:'eine', Hecht:'einen', Karpfen:'einen', Rotauge:'ein', Rotfeder:'eine', Schleie:'eine', Wels:'einen', Zander:'einen' };

export function composeShareText(entry) {
  const date = new Date(entry.timestamp).toLocaleDateString('de-DE');
  const time = new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const w = entry.weather || {};
  const article = FISH_ARTICLES[entry.fish] || 'einen';

  return `🎣 Ich habe am ${date} um ${time} ${article} ${entry.fish} gefangen!
📏 Größe: ${entry.size} cm
🌡 Wetter: ${w?.temp ?? '?'} °C, ${w?.description ?? 'unbekannt'}
💨 Wind: ${w?.wind ?? '?'} m/s${w?.wind_deg !== undefined ? ` aus ${windDirection(w.wind_deg)}` : ''}
🧪 Luftdruck: ${w?.pressure ?? '?'} hPa • 💦 Feuchte: ${w?.humidity ?? '?'} %
🌙 Mond: ${getMoonDescription(w?.moon_phase)}`;
}

export async function shareEntry(entry) {
  const shareText = composeShareText(entry);
  try {
    let files = [];
    if (entry.photo_url) {
      const resp = await fetch(entry.photo_url);
      const blob = await resp.blob();
      files = [new File([blob], 'fangfoto.jpg', { type: blob.type })];
    }
    await navigator.share({ title: 'Mein Fang', text: shareText, files });
  } catch (err) {
    if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return;
    try { await navigator.clipboard.writeText(shareText); alert('📋 Fanginfo kopiert!'); }
    catch { alert('Teilen nicht unterstützt.'); }
  }
}
