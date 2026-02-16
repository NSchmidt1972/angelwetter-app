import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { APP_VERSION, GIT_COMMIT } from '@/utils/buildInfo';
import { getActiveClubId } from '@/utils/clubId';
import {
  getOrCreatePageViewSessionId,
  getStoredAnglerName,
  isExcludedAngler,
} from '@/utils/pageViewClient';

const MIN_INTERVAL_MS = 5000;

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

    const angler = getStoredAnglerName();
    if (isExcludedAngler(angler)) return;
    const clubId = getActiveClubId();
    if (!clubId) return;

    const payload = {
      club_id: clubId,
      path,
      full_path: href,
      angler,
      session_id: getOrCreatePageViewSessionId(),
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
