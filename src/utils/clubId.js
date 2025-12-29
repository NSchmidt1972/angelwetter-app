// src/utils/clubId.js
// Zentraler Ort für die Vereinsauswahl. Aktuell einfacher Fallback:
// - VITE_DEFAULT_CLUB_ID aus .env
// - optional gespeicherter Wert in localStorage (activeClubId)
// Passe DEFAULT_CLUB_ID an euren tatsächlichen Default an.
const FALLBACK_CLUB_ID = import.meta.env.VITE_DEFAULT_CLUB_ID || '00000000-0000-0000-0000-000000000001';

export function getActiveClubId() {
  try {
    const stored = window.localStorage.getItem('activeClubId');
    if (stored) return stored;
  } catch {
    /* ignore storage errors */
  }
  return FALLBACK_CLUB_ID;
}

export function setActiveClubId(clubId) {
  try {
    window.localStorage.setItem('activeClubId', clubId);
  } catch {
    /* ignore */
  }
}
