// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './AuthContext';
import './index.css';
import './styles/tokens.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';
import './styles/base.css';
import { installGlobalErrorMonitoring } from '@/services/opsAlert';
import { applyDynamicManifestForPath } from '@/utils/pwaManifest';

function scheduleIdle(callback, timeout = 2000) {
  if (typeof window === 'undefined') return;
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout });
    return;
  }
  window.setTimeout(callback, 800);
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    scheduleIdle(async () => {
      try {
        const { registerSW } = await import('virtual:pwa-register');
        // App-SW bewusst auf Root lassen:
        // Tenant-Identitaet wird ueber dynamisches Manifest (id/start_url/scope) gesteuert.
        // So bleibt OneSignal-SW-Kommunikation stabil, auch wenn Tenant-Pfade variieren.
        registerSW({ immediate: true });
      } catch (err) {
        console.warn('[PWA] Service-Worker Registrierung übersprungen:', err);
      }
    });
  }, { once: true });
}

applyDynamicManifestForPath();

installGlobalErrorMonitoring();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
