import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/angelwetter-app/',
  plugins: [
    react(),
    VitePWA({
      // Kein Service Worker registrieren
      injectRegister: null,
      registerType: undefined,

      // Nur Manifest und Icons behalten
      includeAssets: ['icons/*.png', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: '/manifest.webmanifest',

      // Workbox deaktivieren
      workbox: null,

      // Deaktiviert SW auch im Dev-Modus
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
  },
});
