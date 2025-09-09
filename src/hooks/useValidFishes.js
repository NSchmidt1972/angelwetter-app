// src/hooks/useValidFishes.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

function useAbortableFetch() {
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  return () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };
}

export function useLocalStorageValue(key, defaultValue) {
  const [val, setVal] = useState(() => localStorage.getItem(key) ?? defaultValue);
  useEffect(() => {
    const onStorage = (e) => { if (e.key === key) setVal(e.newValue ?? defaultValue); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, defaultValue]);
  return [val, setVal];
}

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

// Robuster Datumsparser (ISO, "YYYY-MM-DD HH:mm:ss", Timestamp, etc.)
function safeDate(ts) {
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') {
    let s = ts.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T12:00:00';
    if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(NaN);
}

/**
 * Lädt Fänge aus Supabase, filtert sie nach Sichtbarkeit und erzeugt validFishes.
 * Sichtbarkeit:
 *  - Vertraute: 'all' → alle, sonst nur ab PUBLIC_FROM
 *  - Nicht-Vertraute: nur ab PUBLIC_FROM
 */
export function useValidFishes({ PUBLIC_FROM, vertraute }) {
  const abortable = useAbortableFetch();

  const [storedAnglerName] = useLocalStorageValue('anglerName', 'Unbekannt');
  const anglerName = (storedAnglerName || 'Unbekannt').trim();
  const istVertrauter = vertraute.includes(anglerName);
  const [filterSetting] = useLocalStorageValue('dataFilter', 'recent');

  const [fishes, setFishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function load() {
      const signal = abortable();
      setLoading(true);
      setLoadError(null);
      try {
        // WICHTIG: '*' nehmen, um 400 durch fehlende Spalten zu vermeiden
        const query = supabase.from('fishes').select('*');

        const { data, error, status } = await withTimeout(query, 8000);
        if (error) {
          // 400/… sauber loggen
          console.error('[useValidFishes] Supabase error', { status, error });
          throw error;
        }

        const arr = Array.isArray(data) ? data : [];
        const filtered = arr.filter((f) => {
          const fangDatum = safeDate(f.timestamp);
          return istVertrauter
            ? (filterSetting === 'all' || fangDatum >= PUBLIC_FROM)
            : fangDatum >= PUBLIC_FROM;
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
  }, [istVertrauter, filterSetting]);

  const validFishes = useMemo(() => {
    return fishes.filter((f) => {
      if (f.blank) return false;
      const nameOk =
        typeof f.fish === 'string' &&
        f.fish.trim() !== '' &&
        f.fish.toLowerCase() !== 'unbekannt';
      const size = parseFloat(f.size);
      return nameOk && !Number.isNaN(size) && size > 0;
    });
  }, [fishes]);

  // Exponiere loadError, damit die Page was anzeigen kann
  return { fishes, validFishes, loading, loadError, anglerName, filterSetting, istVertrauter };
}
