import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // ← WICHTIG: Das brauchst du für den Alias

export default defineConfig({
  base: '/angelwetter-app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // ← DAS aktiviert @/
    },
  },
  server: {
    host: true,
  },
});
