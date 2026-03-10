// src/hooks/useValidFishes.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { useViewerContext } from '@/hooks/useViewerContext';
import { PUBLIC_FROM as DEFAULT_PUBLIC_FROM, TRUSTED_ANGLERS } from '@/constants/visibility';
import { isMarilouAngler, isTrustedAngler, isVisibleByDate } from '@/utils/visibilityPolicy';
import { isValuableFishEntry } from '@/utils/fishValidation';
import { FISH_SELECT, fetchClubFishesQuery } from '@/services/fishes';

function useAbortableFetch() {
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  return () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };
}

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

/**
 * Lädt Fänge aus Supabase, filtert sie nach Sichtbarkeit und erzeugt validFishes.
 * Sichtbarkeit:
 *  - Vertraute: 'all' → alle, sonst nur ab PUBLIC_FROM
 *  - Nicht-Vertraute: nur ab PUBLIC_FROM
 */
export function useValidFishes({ PUBLIC_FROM: publicFromArg, vertraute } = {}) {
  const resumeTick = useAppResumeTick({ enabled: true });
  const abortable = useAbortableFetch();

  const { anglerName, filterSetting, isMarilouViewer } = useViewerContext();
  const trustedNames = Array.isArray(vertraute) ? vertraute : TRUSTED_ANGLERS;
  const trustedNamesSet = useMemo(
    () => new Set(trustedNames.map((name) => String(name || '').trim().toLowerCase())),
    [trustedNames]
  );
  const isTrustedByConfig = useMemo(
    () => trustedNamesSet.has(anglerName.toLowerCase()),
    [anglerName, trustedNamesSet]
  );
  const istVertrauter = isTrustedByConfig || isTrustedAngler(anglerName);
  const visibilityStart = publicFromArg || DEFAULT_PUBLIC_FROM;

  const [fishes, setFishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function load() {
      const signal = abortable();
      setLoading(true);
      setLoadError(null);
      try {
        const query = fetchClubFishesQuery({ select: FISH_SELECT.VALIDATION });

        const { data, error, status } = await withTimeout(query, 8000);
        if (error) {
          // 400/… sauber loggen
          console.error('[useValidFishes] Supabase error', { status, error });
          throw error;
        }

        const arr = Array.isArray(data) ? data : [];
        const filtered = arr.filter((f) => {
          const withinVisibility = isVisibleByDate(f?.timestamp, {
            isTrusted: istVertrauter,
            filterSetting,
            publicFrom: visibilityStart,
          });
          if (!withinVisibility) return false;

          if (isMarilouAngler(f?.angler) && !isMarilouViewer) return false;
          return true;
        });

        if (!signal.aborted) setFishes(filtered);
      } catch (e) {
        console.warn('Fänge konnten nicht geladen werden:', e?.message || e);
        setFishes([]);
        setLoadError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSetting, isMarilouViewer, istVertrauter, resumeTick, visibilityStart]);

  const validFishes = useMemo(() => {
    return fishes.filter((f) => isValuableFishEntry(f));
  }, [fishes]);

  // Exponiere loadError, damit die Page was anzeigen kann
  return {
    fishes,
    validFishes,
    loading,
    loadError,
    anglerName,
    filterSetting,
    istVertrauter,
    isMarilou: isMarilouViewer,
  };
}
