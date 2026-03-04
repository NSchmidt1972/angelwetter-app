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
const PAGE_VIEW_QUEUE_KEY = 'aw_page_view_queue_v1';
const PAGE_VIEW_QUEUE_LIMIT = 500;
const PAGE_VIEW_BATCH_SIZE = 50;
const NULL_CLUB_ID = '00000000-0000-0000-0000-000000000000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let flushInFlight = null;

function isValidClubId(clubId) {
  return (
    typeof clubId === 'string' &&
    UUID_RE.test(clubId) &&
    clubId !== NULL_CLUB_ID
  );
}

function readQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PAGE_VIEW_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  if (typeof window === 'undefined') return;
  try {
    if (!Array.isArray(queue) || queue.length === 0) {
      window.localStorage.removeItem(PAGE_VIEW_QUEUE_KEY);
      return;
    }
    window.localStorage.setItem(PAGE_VIEW_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* ignore storage errors */
  }
}

function enqueuePageView(payload) {
  const queue = readQueue();
  queue.push(payload);
  if (queue.length > PAGE_VIEW_QUEUE_LIMIT) {
    queue.splice(0, queue.length - PAGE_VIEW_QUEUE_LIMIT);
  }
  writeQueue(queue);
}

async function flushPageViewQueue() {
  const queue = readQueue();
  if (queue.length === 0) return;

  let remaining = queue;
  while (remaining.length > 0) {
    const batch = remaining.slice(0, PAGE_VIEW_BATCH_SIZE);
    const { error: pageViewError } = await supabase
      .from('page_views')
      .insert(batch);

    if (pageViewError) {
      // Harte Fehler (z. B. 401/403) nicht endlos spammen.
      if (pageViewError.status === 401 || pageViewError.status === 403) {
        writeQueue([]);
      } else {
        writeQueue(remaining);
      }
      return;
    }

    // Optionaler Spiegel in analytics_events (falls Migration bereits aktiv).
    const analyticsBatch = batch.map((entry) => ({
      club_id: entry.club_id,
      user_id: null,
      event_name: 'page_view',
      path: entry.path,
      full_path: entry.full_path,
      angler: entry.angler,
      session_id: entry.session_id,
      properties: entry.metadata || {},
      occurred_at: entry.created_at,
    }));
    await supabase.from('analytics_events').insert(analyticsBatch);

    remaining = remaining.slice(PAGE_VIEW_BATCH_SIZE);
    writeQueue(remaining);
  }
}

async function flushPageViewQueueLocked() {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    try {
      await flushPageViewQueue();
    } finally {
      flushInFlight = null;
    }
  })();
  return flushInFlight;
}

export function usePageViewTracker({ enabled = true, clubId: forcedClubId = null, anglerName: forcedAnglerName = null } = {}) {
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

    const angler = (forcedAnglerName || getStoredAnglerName() || '').trim() || null;
    if (isExcludedAngler(angler)) return;
    const clubId = forcedClubId || getActiveClubId();
    if (!isValidClubId(clubId)) return;

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

    enqueuePageView(payload);
    flushPageViewQueueLocked().catch((error) => {
      console.warn('Page view Queue-Flush fehlgeschlagen:', error);
    });
  }, [enabled, forcedAnglerName, forcedClubId, location.pathname, location.search]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const onOnline = () => {
      flushPageViewQueueLocked().catch((error) => {
        console.warn('Page view Queue-Flush (online) fehlgeschlagen:', error);
      });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [enabled]);
}
