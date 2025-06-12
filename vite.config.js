import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const basePath = mode === 'production' ? '/angelwetter-app/' : '/';

  return {
    base: basePath,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'robots.txt'],
        manifest: {
          name: 'AngelWetter App',
          short_name: 'AngelWetter',
          start_url: `${basePath}`, // <-- hier auf basePath umgestellt
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#3b82f6',
          icons: [
            {
              src: `${basePath}icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${basePath}icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
    },
  };
});
