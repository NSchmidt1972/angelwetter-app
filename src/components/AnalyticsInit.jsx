import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GTAG_ID = import.meta.env.VITE_GTAG_ID?.trim() || '';
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
  const isUxTestMode = import.meta.env.VITE_UX_TEST_MODE === '1';
  const trackingEnabled = Boolean(GTAG_ID);

  useEffect(() => {
    if (isUxTestMode) return;
    if (!trackingEnabled) return;
    if (!shouldTrackPath(location.pathname)) return;

    let cancelled = false;
    let started = false;

    const start = async () => {
      if (started || cancelled) return;
      started = true;
      const ready = await ensureTagScriptLoaded();
      if (!ready || cancelled || typeof window.gtag !== 'function') return;
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
      });
    };

    const interactionEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    const onInteraction = () => {
      void start();
    };

    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, onInteraction, { once: true, passive: true });
    });

    const timerId = window.setTimeout(() => {
      void start();
    }, 6000);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onInteraction);
      });
    };
  }, [isUxTestMode, trackingEnabled, location.pathname, location.search]);

  return null;
}
