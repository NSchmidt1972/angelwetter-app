// src/hooks/useCatches.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_SIZE, CACHE_KEY, VERTRAUTE, PUBLIC_FROM } from '../constants';
import { listFishes, countFishes, updateFish as svcUpdate, deleteFish as svcDelete } from '../services/fishes';
import { uploadPhotoAndGetUrl } from '../services/storage';
import { isVisibleToUser } from '../utils/filters';
import { readCache, writeCache } from '../utils/cache';

export function useCatches(anglerName, onlyMine) {
  const [catches, setCatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(null);

  const isTrusted = useMemo(() => VERTRAUTE.includes(anglerName), [anglerName]);
  const sentinelRef = useRef(null);

  // initial cache warm
  useEffect(() => {
    const cached = readCache(CACHE_KEY);
    if (cached?.items?.length) setCatches(cached.items);
    setLoading(true);
    setHasMore(true);
    setPage(0);
  }, []);

  const fetchPage = useCallback(async (p) => {
    setLoading(true);
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const q = await listFishes({ from, to, onlyMine, anglerName });
    const { data, error } = await q;
    if (error) { console.error('Fänge laden:', error); setLoading(false); return { items: [] }; }

    const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';
    const filtered = (data || []).filter(f => isVisibleToUser(f, { isTrusted, onlyMine, anglerName, filterSetting }));

    setCatches(prev => (p === 0 ? filtered : [...prev, ...filtered]));
    setHasMore((data || []).length === PAGE_SIZE);
    setLoading(false);

    if (p === 0) writeCache(CACHE_KEY, { items: filtered, hasMore: true });

    return { items: filtered };
  }, [onlyMine, anglerName, isTrusted]);

  // page effect
  useEffect(() => { fetchPage(page); }, [page, fetchPage]);

  // total count
  useEffect(() => {
    (async () => {
      const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';
      const fromIso = (!isTrusted || filterSetting !== 'all') ? new Date('2025-06-01').toISOString() : null;
      const { count, error } = await countFishes({ onlyMine, anglerName, fromIso });
      if (error) { console.error('Gesamtanzahl laden:', error); setTotalCount(null); }
      else setTotalCount(count ?? 0);
    })();
  }, [onlyMine, anglerName, isTrusted]);

  const loadNext = useCallback(() => setPage(p => p + 1), []);
  const reset = useCallback(() => { setPage(0); }, []);

  // editing helpers
  const updateEntry = useCallback(async ({ entry, fish, size, note, photoFile }) => {
    let photo_url = entry.photo_url;
    if (photoFile) photo_url = await uploadPhotoAndGetUrl({ file: photoFile, id: entry.id });

    const { error } = await svcUpdate(entry.id, { fish, size: parseFloat(size), note, photo_url });
    if (error) throw error;

    setCatches(prev => prev.map(c => c.id === entry.id ? { ...c, fish, size: parseFloat(size), note, photo_url } : c));
  }, []);

  const deleteEntry = useCallback(async (id) => {
    const { error } = await svcDelete(id);
    if (error) throw error;
    setCatches(prev => prev.filter(f => f.id !== id));
    setTotalCount(tc => (typeof tc === 'number' ? Math.max(tc - 1, 0) : tc));
  }, []);

  return { catches, loading, hasMore, totalCount, loadNext, sentinelRef, updateEntry, deleteEntry, reset };
}
