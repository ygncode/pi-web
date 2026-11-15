import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // The Go server serves built assets under /static/. Without this, the chunk
  // loader resolves dynamic imports against /assets/ and they 404.
  base: '/static/',
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
          // NOTE: highlight.js is deliberately NOT forced into a manual chunk.
          // It is only ever imported dynamically (lazy-highlight.js,
          // ArtifactPanel), and forcing it into a named chunk made Vite hoist
          // its modulepreload helper there — pulling ~900 KB of highlight.js
          // into the entry's static graph on every first paint.
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
