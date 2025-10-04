// src/utils/pageViewClient.js
const SESSION_STORAGE_KEY = 'aw_page_view_session';

export function getOrCreatePageViewSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.sessionStorage;
    if (!storage) return null;
    let value = storage.getItem(SESSION_STORAGE_KEY);
    if (!value) {
      const generator = typeof crypto !== 'undefined' && crypto.randomUUID
        ? () => crypto.randomUUID()
        : () => `sess-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      value = generator();
      storage.setItem(SESSION_STORAGE_KEY, value);
    }
    return value;
  } catch (error) {
    console.warn('Session-ID konnte nicht erzeugt werden:', error);
    return null;
  }
}

export function getStoredAnglerName() {
  if (typeof window === 'undefined') return null;
  try {
    const name = (window.localStorage.getItem('anglerName') || '').trim();
    return name || null;
  } catch (error) {
    console.warn('Anglername konnte nicht gelesen werden:', error);
    return null;
  }
}

export function isExcludedAngler(name) {
  if (!name) return false;
  return name.trim().toLowerCase() === 'nicol schmidt';
}
