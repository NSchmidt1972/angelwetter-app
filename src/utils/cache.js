// src/utils/cache.js
export function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (error) {
    console.warn('Cache lesen fehlgeschlagen:', error);
    return null;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Cache schreiben fehlgeschlagen:', error);
  }
}
