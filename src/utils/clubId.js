// src/utils/clubId.js
// Zentraler Ort für die Vereinsauswahl.
// Reihenfolge:
// 1) localStorage.activeClubId
// 2) Domain-Mapping (host → club_slug → club_id)
// 3) VITE_DEFAULT_CLUB_ID aus .env
// 4) sonst null
import { debugLog } from '@/utils/runtimeDebug';
import { getTenantFromPathname, normalizeTenantSlug } from '@/utils/tenantPath';

const NULL_CLUB_ID = '00000000-0000-0000-0000-000000000000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DOMAIN_CLUB_SLUG_MAP = {
  'app.asv-rotauge.de': 'asv-rotauge',
  'localhost': 'asv-rotauge',
  '127.0.0.1': 'asv-rotauge',
  '::1': 'asv-rotauge',
};

const ENV_DEFAULT_CLUB_ID = normalizeClubId(import.meta.env.VITE_DEFAULT_CLUB_ID || null);
const CLUB_SLUG_MAP_KEY = 'angelwetter_club_slug_map_v1';
const ACTIVE_CLUB_SLUG_KEY = 'angelwetter_active_club_slug_v1';
const ACTIVE_CLUB_SLUG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

let activeClubIdMemory = null;
let clubSlugMapMemory = null;
let activeClubSlugMemory = null;

function dispatchClubContextChange(detail = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('angelwetter:club-context-changed', { detail }));
  } catch {
    window.dispatchEvent(new Event('angelwetter:club-context-changed'));
  }
}

function normalizeClubId(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === NULL_CLUB_ID) return null;
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed;
}

function normalizeSlug(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function normalizeClubSlug(value) {
  return normalizeTenantSlug(value);
}

function rememberActiveClubSlug(slug) {
  const normalizedSlug = normalizeClubSlug(slug);
  if (!normalizedSlug) return;
  const changed = activeClubSlugMemory !== normalizedSlug;
  activeClubSlugMemory = normalizedSlug;
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ACTIVE_CLUB_SLUG_KEY, normalizedSlug);
  } catch {
    /* ignore storage errors */
  }

  if (!changed && typeof document === 'undefined') return;
  try {
    document.cookie = `${ACTIVE_CLUB_SLUG_KEY}=${encodeURIComponent(normalizedSlug)}; path=/; max-age=${ACTIVE_CLUB_SLUG_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    /* ignore cookie errors */
  }
}

function readCookieValue(key) {
  if (typeof document === 'undefined') return null;
  const raw = String(document.cookie || '');
  if (!raw) return null;
  const parts = raw.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const cookieKey = trimmed.slice(0, separatorIndex).trim();
    if (cookieKey !== key) continue;
    const cookieValue = trimmed.slice(separatorIndex + 1);
    try {
      return decodeURIComponent(cookieValue);
    } catch {
      return cookieValue;
    }
  }
  return null;
}

function getStoredActiveClubSlug() {
  if (activeClubSlugMemory) return activeClubSlugMemory;
  if (typeof window === 'undefined') return null;
  try {
    const stored = normalizeClubSlug(window.localStorage.getItem(ACTIVE_CLUB_SLUG_KEY));
    if (stored) {
      activeClubSlugMemory = stored;
      return stored;
    }
  } catch {
    /* ignore storage errors */
  }
  const cookieSlug = normalizeClubSlug(readCookieValue(ACTIVE_CLUB_SLUG_KEY));
  if (cookieSlug) {
    rememberActiveClubSlug(cookieSlug);
    return cookieSlug;
  }
  return null;
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
  const normalized = getTenantFromPathname(window.location.pathname);
  if (!normalized) return null;
  rememberActiveClubSlug(normalized);
  return normalized;
}

function getClubSlugFromPathname(pathname) {
  return getTenantFromPathname(pathname);
}

export function syncActiveClubSlugFromPathname(pathname) {
  const normalized = getClubSlugFromPathname(pathname);
  if (!normalized) return null;
  rememberActiveClubSlug(normalized);
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
    const stored = normalizeClubId(window.localStorage.getItem('activeClubId'));
    if (stored) {
      activeClubIdMemory = stored;
      return stored;
    }
  } catch {
    /* ignore storage errors */
  }

  // 2) Host-basiertes Mapping (automatisch pro Domain über bekannten Slug)
  try {
    const host = normalizeSlug(window.location.hostname);
    const mappedSlug = host ? DOMAIN_CLUB_SLUG_MAP[host] : null;
    if (mappedSlug) {
      const mappedClubId = getClubIdForSlug(mappedSlug);
      if (mappedClubId) {
        activeClubIdMemory = mappedClubId;
        return mappedClubId;
      }
    }
  } catch {
    /* ignore */
  }

  // 3) Env-Default oder null
  activeClubIdMemory = ENV_DEFAULT_CLUB_ID;
  return ENV_DEFAULT_CLUB_ID;
}

export function setActiveClubId(clubId) {
  const normalized = normalizeClubId(clubId);
  if (!normalized) return;
  const previous = activeClubIdMemory;
  if (previous === normalized) return;
  activeClubIdMemory = normalized;
  try {
    const stored = window.localStorage.getItem('activeClubId');
    if (stored !== activeClubIdMemory) {
      window.localStorage.setItem('activeClubId', activeClubIdMemory);
    }
  } catch {
    /* ignore */
  }
  debugLog('clubid:set-active', { clubId: normalized });
  dispatchClubContextChange({ clubId: normalized, source: 'setActiveClubId' });
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
  dispatchClubContextChange({ clubId: null, source: 'clearActiveClubId' });
}

export function getClubIdForSlug(slug) {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;

  const map = readClubSlugMap();
  const mapped = normalizeClubId(map[normalizedSlug]);
  if (mapped) return mapped;
  return null;
}

function getSlugForClubId(clubId) {
  const normalizedClubId = normalizeClubId(clubId);
  if (!normalizedClubId) return null;

  const map = readClubSlugMap();
  for (const [slug, mappedClubId] of Object.entries(map)) {
    if (normalizeClubId(mappedClubId) !== normalizedClubId) continue;
    const normalizedSlug = normalizeSlug(slug);
    if (normalizedSlug) return normalizedSlug;
  }

  return null;
}

export function getPreferredClubSlug({ fallbackSlug = 'asv-rotauge' } = {}) {
  const slugFromPath = getSlugFromPathname();
  if (slugFromPath) return slugFromPath;

  const storedActiveSlug = getStoredActiveClubSlug();
  if (storedActiveSlug) return storedActiveSlug;

  const activeClubId = getActiveClubId();
  const slugFromActiveClubId = getSlugForClubId(activeClubId);
  if (slugFromActiveClubId) return slugFromActiveClubId;

  try {
    const host = normalizeSlug(window.location.hostname);
    const mappedSlug = host ? normalizeSlug(DOMAIN_CLUB_SLUG_MAP[host]) : null;
    if (mappedSlug) return mappedSlug;
  } catch {
    /* ignore */
  }

  return normalizeSlug(fallbackSlug) || 'asv-rotauge';
}

export function rememberClubSlugId(slug, clubId) {
  const normalizedSlug = normalizeSlug(slug);
  const normalizedClubId = normalizeClubId(clubId);
  if (!normalizedSlug || !normalizedClubId) return;
  rememberActiveClubSlug(normalizedSlug);

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
  dispatchClubContextChange({ clubId: normalizedClubId, slug: normalizedSlug, source: 'rememberClubSlugId' });
}
