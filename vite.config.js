import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/surya-player/' : './',
  publicDir: 'audio',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: { web: resolve(import.meta.dirname, 'index.html'), desktop: resolve(import.meta.dirname, 'desktop.html') } },
  },
});
