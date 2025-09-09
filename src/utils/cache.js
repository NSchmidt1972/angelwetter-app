// src/utils/cache.js
export function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
export function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
