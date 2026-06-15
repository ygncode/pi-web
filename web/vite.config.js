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
      },
      output: {
        manualChunks(id) {
          if (id.includes('highlight.js')) return 'hljs';
          // NOTE: do NOT force @pierre/diffs / shiki into a single manual chunk.
          // The dynamic import('@pierre/diffs') already splits it off, and shiki
          // lazy-loads individual language grammars as separate chunks. Grouping
          // them all here inlines every grammar into one ~10 MB blob that stalls
          // the diff modal on slow/remote links.
        },
      },
    },
  },
});
