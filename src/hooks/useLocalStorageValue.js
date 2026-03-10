import { useCallback, useEffect, useState } from 'react';

export function useLocalStorageValue(key, defaultValue) {
  const readValue = useCallback(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      return window.localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }, [key, defaultValue]);

  const [value, setValue] = useState(() => readValue());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const sync = () => setValue(readValue());
    const onStorage = (event) => {
      if (!event.key || event.key === key) sync();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sync();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', sync);
    window.addEventListener('angelwetter:storage-sync', sync);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', sync);
      window.removeEventListener('angelwetter:storage-sync', sync);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [key, defaultValue, readValue]);

  return [value, setValue];
}
