import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GTAG_ID = import.meta.env.VITE_GTAG_ID?.trim() || 'G-HRCMPRWC6D';
const STATIC_PUBLIC_PATHS = new Set([
  '/auth',
  '/update-password',
  '/reset-done',
  '/auth-verified',
  '/forgot-password',
]);

function isClubAuthPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 2 && segments[1].toLowerCase() === 'auth';
}

function shouldTrackPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  return !STATIC_PUBLIC_PATHS.has(pathname) && !isClubAuthPath(pathname);
}

function scheduleIdle(callback, timeout = 2000) {
  if (typeof window === 'undefined') return () => {};
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 1000);
  return () => window.clearTimeout(id);
}

function ensureTagScriptLoaded() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.__gtagReady) return Promise.resolve(true);

  if (!window.dataLayer) window.dataLayer = [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  const existing = document.querySelector('script[data-gtag-loader="true"]');
  if (existing) {
    return new Promise((resolve) => {
      if (window.__gtagReady) {
        resolve(true);
        return;
      }
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GTAG_ID)}`;
    script.dataset.gtagLoader = 'true';
    script.addEventListener('load', () => {
      window.__gtagReady = true;
      window.gtag('js', new Date());
      window.gtag('config', GTAG_ID);
      resolve(true);
    }, { once: true });
    script.addEventListener('error', () => resolve(false), { once: true });
    document.head.appendChild(script);
  });
}

export default function AnalyticsInit() {
  const location = useLocation();

  useEffect(() => {
    if (!shouldTrackPath(location.pathname)) return;

    let cancelled = false;
    const cancelIdle = scheduleIdle(async () => {
      const ready = await ensureTagScriptLoaded();
      if (!ready || cancelled || typeof window.gtag !== 'function') return;
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
      });
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [location.pathname, location.search]);

  return null;
}
