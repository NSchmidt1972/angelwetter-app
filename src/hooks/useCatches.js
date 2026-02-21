// src/hooks/useCatches.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_SIZE, CACHE_KEY, VERTRAUTE } from '../constants';
import {
  listFishes,
  countFishes,
  updateFish as svcUpdate,
  deleteFish as svcDelete,
  updateFishExternalVisibility as svcUpdateExternalVisibility,
} from '../services/fishes';
import { processAndUploadImage } from '../services/imageProcessing';
import { isVisibleToUser } from '../utils/filters';
import { readCache, writeCache } from '../utils/cache';

export function useCatches(anglerName, onlyMine) {
  const [catches, setCatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(null);
  const [visibilityPending, setVisibilityPending] = useState({});

  const isTrusted = useMemo(() => VERTRAUTE.includes(anglerName), [anglerName]);
  const sentinelRef = useRef(null);
  const queryVersionRef = useRef(0);
  const applyVisibilityFilter = useCallback((items, mineFlag = onlyMine) => {
    const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';
    return (items || []).filter((entry) =>
      isVisibleToUser(entry, {
        isTrusted,
        onlyMine: mineFlag,
        anglerName,
        filterSetting,
      })
    );
  }, [onlyMine, isTrusted, anglerName]);

  // initial cache warm
  useEffect(() => {
    const cached = readCache(CACHE_KEY);
    if (cached?.items?.length) setCatches(cached.items);
    setLoading(true);
    setHasMore(true);
    setPage(0);
  }, []);

  // reset list state whenever list context changes (e.g. onlyMine toggle)
  useEffect(() => {
    queryVersionRef.current += 1;
    setCatches([]);
    setHasMore(true);
    setPage(0);
    setLoading(true);
  }, [onlyMine, anglerName]);

  const fetchPage = useCallback(async (p) => {
    const versionAtStart = queryVersionRef.current;
    setLoading(true);
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const q = await listFishes({ from, to, onlyMine, anglerName });
    const { data, error } = await q;
    if (versionAtStart !== queryVersionRef.current) return { items: [] };
    if (error) { console.error('Fänge laden:', error); setLoading(false); return { items: [] }; }

    const filtered = applyVisibilityFilter(data, onlyMine);

    setCatches(prev => (p === 0 ? filtered : [...prev, ...filtered]));
    setHasMore((data || []).length === PAGE_SIZE);
    setLoading(false);

    if (p === 0) writeCache(CACHE_KEY, { items: filtered, hasMore: true });

    return { items: filtered };
  }, [onlyMine, anglerName, applyVisibilityFilter]);

  // page effect
  useEffect(() => { fetchPage(page); }, [page, fetchPage]);

  // total count
  useEffect(() => {
    let active = true;
    (async () => {
      const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';
      const fromIso = (!isTrusted || filterSetting !== 'all') ? new Date('2025-06-01').toISOString() : null;
      const { count, error } = await countFishes({ onlyMine, anglerName, fromIso });
      if (!active) return;
      if (error) { console.error('Gesamtanzahl laden:', error); setTotalCount(null); }
      else setTotalCount(count ?? 0);
    })();
    return () => {
      active = false;
    };
  }, [onlyMine, anglerName, isTrusted]);

  const loadNext = useCallback(() => {
    if (loading || !hasMore) return;
    setPage((p) => p + 1);
  }, [loading, hasMore]);
  const reset = useCallback(() => { setPage(0); }, []);

  // editing helpers
  const updateEntry = useCallback(async ({ entry, fish, size, note, photoFile, lat, lon, locationName }) => {
    let photo_url = entry.photo_url;

    if (photoFile) {
      photo_url = await processAndUploadImage(photoFile, entry.angler || 'Unbekannt');
    }

    const sizeValue = parseFloat(size);
    const latValue =
      lat === '' || lat == null ? null : typeof lat === 'number' ? lat : parseFloat(lat);
    const lonValue =
      lon === '' || lon == null ? null : typeof lon === 'number' ? lon : parseFloat(lon);
    const location_name = locationName?.trim() ? locationName.trim() : null;

    const payload = {
      fish,
      size: sizeValue,
      note,
      photo_url,
      location_name,
      lat: latValue,
      lon: lonValue,
    };

    const { error } = await svcUpdate(entry.id, payload);
    if (error) throw error;

    setCatches(prev => {
      const updated = prev.map(c =>
        c.id === entry.id
          ? { ...c, ...payload }
          : c
      );
      return applyVisibilityFilter(updated, onlyMine);
    });
  }, [applyVisibilityFilter, onlyMine]);

  const setExternalVisibility = useCallback(async (entryId, enabled) => {
    if (!entryId) return;

    setVisibilityPending((prev) => ({ ...prev, [entryId]: true }));
    try {
      const { error } = await svcUpdateExternalVisibility(entryId, enabled);
      if (error) throw error;

      setCatches((prev) => {
        const updated = prev.map((entry) =>
          entry.id === entryId
            ? { ...entry, share_public_non_home: !!enabled }
            : entry
        );
        return applyVisibilityFilter(updated, onlyMine);
      });
    } finally {
      setVisibilityPending((prev) => ({ ...prev, [entryId]: false }));
    }
  }, [applyVisibilityFilter, onlyMine]);

  const deleteEntry = useCallback(async (id) => {
    const { error } = await svcDelete(id);
    if (error) throw error;
    setCatches(prev => prev.filter(f => f.id !== id));
    setTotalCount(tc => (typeof tc === 'number' ? Math.max(tc - 1, 0) : tc));
  }, []);

  const isVisibilityPending = useCallback((entryId) => !!visibilityPending[entryId], [visibilityPending]);

  return {
    catches,
    loading,
    hasMore,
    totalCount,
    loadNext,
    sentinelRef,
    updateEntry,
    deleteEntry,
    setExternalVisibility,
    isVisibilityPending,
    reset,
  };
}
