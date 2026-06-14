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
          // The diff viewer (shiki + workers) is large and only needed when the
          // diff modal opens, so keep it in its own lazily-loaded chunk.
          if (id.includes('@pierre/diffs') || id.includes('shiki') || id.includes('@shikijs')) {
            return 'diffs';
          }
        },
      },
    },
  },
});
