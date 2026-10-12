import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build can be hosted from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react()],
  // The bundle is mostly the world map data (~360 kB gzipped); that's expected.
  build: { chunkSizeWarningLimit: 1500 },
});
