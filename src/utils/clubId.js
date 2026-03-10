// src/utils/clubId.js
// Zentraler Ort für die Vereinsauswahl.
// Reihenfolge:
// 1) localStorage.activeClubId
// 2) Domain-Mapping (host → club_id)
// 3) VITE_DEFAULT_CLUB_ID aus .env
// 4) Fallback: Null-Club
import { debugLog } from '@/utils/runtimeDebug';

const ASV_ROTAUGE_ID = '00000000-0000-0000-0000-000000000001';

const DOMAIN_CLUB_MAP = {
  'app.asv-rotauge.de': ASV_ROTAUGE_ID,
  'localhost': ASV_ROTAUGE_ID,
  '127.0.0.1': ASV_ROTAUGE_ID,
  '::1': ASV_ROTAUGE_ID,
};

const FALLBACK_CLUB_ID =
  import.meta.env.VITE_DEFAULT_CLUB_ID ||
  ASV_ROTAUGE_ID;
const CLUB_SLUG_MAP_KEY = 'angelwetter_club_slug_map_v1';

let activeClubIdMemory = null;
let clubSlugMapMemory = null;
const STATIC_NON_CLUB_SEGMENTS = new Set([
  'auth',
  'update-password',
  'reset-done',
  'auth-verified',
  'forgot-password',
]);

function normalizeClubId(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeSlug(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function readClubSlugMap() {
  if (clubSlugMapMemory) return clubSlugMapMemory;
  clubSlugMapMemory = {};
  if (typeof window === 'undefined') return clubSlugMapMemory;
  try {
    const raw = window.localStorage.getItem(CLUB_SLUG_MAP_KEY);
    if (!raw) return clubSlugMapMemory;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      clubSlugMapMemory = parsed;
    }
  } catch {
    /* ignore parse/storage errors */
  }
  return clubSlugMapMemory;
}

function writeClubSlugMap(nextMap) {
  clubSlugMapMemory = nextMap && typeof nextMap === 'object' ? nextMap : {};
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLUB_SLUG_MAP_KEY, JSON.stringify(clubSlugMapMemory));
  } catch {
    /* ignore storage errors */
  }
}

function getSlugFromPathname() {
  if (typeof window === 'undefined') return null;
  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0] || null;
  const normalized = normalizeSlug(firstSegment);
  if (!normalized) return null;
  if (STATIC_NON_CLUB_SEGMENTS.has(normalized)) return null;
  return normalized;
}

export function getActiveClubId() {
  const slugFromPath = getSlugFromPathname();
  if (slugFromPath) {
    const bySlug = getClubIdForSlug(slugFromPath);
    if (bySlug) {
      activeClubIdMemory = bySlug;
      try {
        window.localStorage.setItem('activeClubId', bySlug);
      } catch {
        /* ignore storage errors */
      }
      debugLog('clubid:resolved-by-slug', {
        slug: slugFromPath,
        clubId: bySlug,
      });
      return bySlug;
    }
  }

  // 0) In-Memory (stabil bei temporären Storage-Problemen nach Resume)
  if (activeClubIdMemory) return activeClubIdMemory;

  // 1) Manuell gesetzter Club (z. B. beim Wechsel)
  try {
    const stored = window.localStorage.getItem('activeClubId');
    if (stored) {
      activeClubIdMemory = stored;
      return stored;
    }
  } catch {
    /* ignore storage errors */
  }

  // 2) Host-basiertes Mapping (automatisch pro Domain)
  try {
    const host = window.location.hostname;
    if (DOMAIN_CLUB_MAP[host]) {
      activeClubIdMemory = DOMAIN_CLUB_MAP[host];
      return DOMAIN_CLUB_MAP[host];
    }
  } catch {
    /* ignore */
  }

  // 3) Env-Default oder Null-Club
  activeClubIdMemory = FALLBACK_CLUB_ID;
  return FALLBACK_CLUB_ID;
}

export function setActiveClubId(clubId) {
  const normalized = normalizeClubId(clubId);
  if (!normalized) return;
  activeClubIdMemory = normalized;
  try {
    window.localStorage.setItem('activeClubId', activeClubIdMemory);
  } catch {
    /* ignore */
  }
  debugLog('clubid:set-active', { clubId: normalized });
}

export function clearActiveClubId() {
  activeClubIdMemory = null;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('activeClubId');
  } catch {
    /* ignore */
  }
  debugLog('clubid:cleared-active', {});
}

export function getClubIdForSlug(slug) {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;

  const map = readClubSlugMap();
  const mapped = normalizeClubId(map[normalizedSlug]);
  if (mapped) return mapped;

  if (normalizedSlug === 'asv-rotauge') return ASV_ROTAUGE_ID;
  return null;
}

export function rememberClubSlugId(slug, clubId) {
  const normalizedSlug = normalizeSlug(slug);
  const normalizedClubId = normalizeClubId(clubId);
  if (!normalizedSlug || !normalizedClubId) return;

  const map = readClubSlugMap();
  if (map[normalizedSlug] === normalizedClubId) return;
  writeClubSlugMap({
    ...map,
    [normalizedSlug]: normalizedClubId,
  });
  debugLog('clubid:remember-slug', {
    slug: normalizedSlug,
    clubId: normalizedClubId,
  });
}
