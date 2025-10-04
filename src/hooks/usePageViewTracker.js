import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { APP_VERSION, GIT_COMMIT } from '@/utils/buildInfo';

const STORAGE_KEY = 'aw_page_view_session';
const MIN_INTERVAL_MS = 5000;

function getSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.sessionStorage;
    if (!storage) return null;
    let value = storage.getItem(STORAGE_KEY);
    if (!value) {
      const generate = typeof crypto !== 'undefined' && crypto.randomUUID
        ? () => crypto.randomUUID()
        : () => `sess-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      value = generate();
      storage.setItem(STORAGE_KEY, value);
    }
    return value;
  } catch (error) {
    console.warn('Session-ID konnte nicht erzeugt werden:', error);
    return null;
  }
}

function getAnglerName() {
  if (typeof window === 'undefined') return null;
  try {
    const name = (window.localStorage.getItem('anglerName') || '').trim();
    return name || null;
  } catch (error) {
    console.warn('Anglername konnte nicht gelesen werden:', error);
    return null;
  }
}

function isExcludedAngler(name) {
  if (!name) return false;
  return name.trim().toLowerCase() === 'nicol schmidt';
}

export function usePageViewTracker({ enabled = true } = {}) {
  const location = useLocation();
  const lastPingRef = useRef({ href: null, at: 0 });

  useEffect(() => {
    if (!enabled) return;
    const path = location.pathname || '/';
    const search = location.search || '';
    const href = `${path}${search}`;

    const now = Date.now();
    const lastPing = lastPingRef.current;
    if (lastPing.href === href && now - lastPing.at < MIN_INTERVAL_MS) {
      return;
    }

    lastPingRef.current = { href, at: now };

    const angler = getAnglerName();
    if (isExcludedAngler(angler)) return;

    const payload = {
      path,
      full_path: href,
      angler,
      session_id: getSessionId(),
      created_at: new Date().toISOString(),
    };

    const metadata = {};
    if (APP_VERSION) metadata.build = APP_VERSION;
    if (GIT_COMMIT) metadata.commit = GIT_COMMIT;
    if (Object.keys(metadata).length > 0) payload.metadata = metadata;

    supabase
      .from('page_views')
      .insert(payload)
      .then(({ error }) => {
        if (error) {
          console.warn('Page view Tracking fehlgeschlagen:', error);
        }
      })
      .catch((error) => {
        console.warn('Page view Tracking nicht möglich:', error);
      });
  }, [enabled, location.pathname, location.search]);
}
