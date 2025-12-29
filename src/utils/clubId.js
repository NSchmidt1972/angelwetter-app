// src/utils/clubId.js
// Zentraler Ort für die Vereinsauswahl.
// Reihenfolge:
// 1) localStorage.activeClubId
// 2) Domain-Mapping (host → club_id)
// 3) VITE_DEFAULT_CLUB_ID aus .env
// 4) Fallback: Null-Club
const DOMAIN_CLUB_MAP = {
  'app.asv-rotauge.de': '00000000-0000-0000-0000-000000000001',
};

const FALLBACK_CLUB_ID =
  import.meta.env.VITE_DEFAULT_CLUB_ID ||
  '00000000-0000-0000-0000-000000000000';

export function getActiveClubId() {
  // 1) Manuell gesetzter Club (z. B. beim Wechsel)
  try {
    const stored = window.localStorage.getItem('activeClubId');
    if (stored) return stored;
  } catch {
    /* ignore storage errors */
  }

  // 2) Host-basiertes Mapping (automatisch pro Domain)
  try {
    const host = window.location.hostname;
    if (DOMAIN_CLUB_MAP[host]) return DOMAIN_CLUB_MAP[host];
  } catch {
    /* ignore */
  }

  // 3) Env-Default oder Null-Club
  return FALLBACK_CLUB_ID;
}

export function setActiveClubId(clubId) {
  try {
    window.localStorage.setItem('activeClubId', clubId);
  } catch {
    /* ignore */
  }
}
