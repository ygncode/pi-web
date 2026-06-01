import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    manifest: true,
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index/index.js'),
        session: resolve(__dirname, 'src/session/session.js'),
        settings: resolve(__dirname, 'src/settings/settings.js'),
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
