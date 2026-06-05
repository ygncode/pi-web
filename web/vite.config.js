import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [svelte()],
  build: {
    manifest: true,
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'src/main.js'),
        index: resolve(__dirname, 'src/index/index-entry.js'),
        session: resolve(__dirname, 'src/session/session.js'),
        settings: resolve(__dirname, 'src/settings/settings-entry.js'),
        live: resolve(__dirname, 'src/live/live.js')
      },
      output: {
        manualChunks(id) {
          if (id.includes('highlight.js')) return 'hljs';
        }
      }
    }
  }
});
