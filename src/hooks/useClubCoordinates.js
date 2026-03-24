import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveClubId } from '@/utils/clubId';
import { fetchClubCoordinates } from '@/services/clubCoordinatesService';

const DEFAULT_TIMEOUT_LABEL = 'Club-Koordinaten timeout';

function areSameCoords(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.lat === b.lat && a.lon === b.lon;
}

export function useClubCoordinates({
  clubId = null,
  enabled = true,
  listenToClubContextChange = false,
  timeoutMs = 10000,
  timeoutLabel = DEFAULT_TIMEOUT_LABEL,
  useCache = false,
  onError = null,
} = {}) {
  const [clubCoords, setClubCoords] = useState(null);
  const mountedRef = useRef(false);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const setSafeClubCoords = useCallback((value) => {
    if (!mountedRef.current) return;
    setClubCoords((prev) => (areSameCoords(prev, value) ? prev : value));
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) {
      setSafeClubCoords(null);
      return null;
    }

    const effectiveClubId = clubId || getActiveClubId();
    if (!effectiveClubId) {
      setSafeClubCoords(null);
      return null;
    }

    try {
      const coords = await fetchClubCoordinates(effectiveClubId, {
        timeoutMs,
        timeoutLabel,
        useCache,
      });
      setSafeClubCoords(coords);
      return coords;
    } catch (error) {
      setSafeClubCoords(null);
      if (typeof onErrorRef.current === 'function') {
        onErrorRef.current(error);
      }
      return null;
    }
  }, [clubId, enabled, setSafeClubCoords, timeoutLabel, timeoutMs, useCache]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!listenToClubContextChange) return undefined;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;

    const handleClubContextChanged = () => {
      void reload();
    };
    window.addEventListener('angelwetter:club-context-changed', handleClubContextChanged);
    return () => {
      window.removeEventListener('angelwetter:club-context-changed', handleClubContextChanged);
    };
  }, [listenToClubContextChange, reload]);

  return { clubCoords, reload };
}
