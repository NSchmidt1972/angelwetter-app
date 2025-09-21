// src/hooks/useLocalStorage.js
// Tiny hook to persist simple values.
import { useEffect, useState } from "react";

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch (error) {
      console.warn('useLocalStorage: Lesen fehlgeschlagen, fallback auf Initialwert.', error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('useLocalStorage: Schreiben fehlgeschlagen.', error);
    }
  }, [key, value]);

  return [value, setValue];
}
