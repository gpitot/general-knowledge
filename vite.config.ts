import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build can be hosted from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react()],
  // The bundle is mostly the world map data (~360 kB gzipped); that's expected.
  build: {
    chunkSizeWarningLimit: 1500,
    // Keep flags as separate files fetched when shown, rather than inlining
    // the small ones into the main bundle.
    assetsInlineLimit: (file) => (file.includes('flag-icons') ? false : undefined),
  },
});
