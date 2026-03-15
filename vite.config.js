// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// erzeugt Build-Info NUR für production-builds
function getBuildInfo() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');

  const buildDate = `${yyyy}-${mm}-${dd}`;
  const buildTime = `${hh}:${mi}`;

  let commit = 'nogit';
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch { /* CI ohne .git ist ok */ }

  return {
    version: `${buildDate}.${hh}${mi}+${commit}`,
    date: `${buildDate} ${buildTime}`,
    commit,
    node: process.version,
    mode: 'production',
  };
}

export default defineConfig(({ command, mode }) => {
  // 👉 Im Dev-Server “dev”, im Build echte Version
  const BUILD_INFO = command === 'build'
    ? getBuildInfo()
    : { version: 'dev', date: null, commit: null, node: process.version, mode };

  return {
    base: '/',
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        injectRegister: null,
        registerType: 'autoUpdate',
        devOptions: { enabled: false },
        includeAssets: ['favicon.svg','logo.png','icon-192.png','icon-512.png'],
        manifest: {
          name: 'Angelwetter',
          short_name: 'Angelwetter',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#007BFF',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        }
      })
    ],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: { host: true },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          tenant: path.resolve(__dirname, 'index.html'),
          superadmin: path.resolve(__dirname, 'superadmin.html'),
        },
        output: { manualChunks: undefined },
      },
    },
    define: {
      __BUILD_INFO__: JSON.stringify(BUILD_INFO),
    },
  };
});
