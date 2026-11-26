import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the built app be served from any folder (GitHub Pages, a university server, ...).
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
