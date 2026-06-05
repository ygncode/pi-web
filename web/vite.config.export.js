import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Builds the static export snapshot bundle as a single self-contained IIFE.
// The output (dist-export/export.js) is inlined verbatim into a <script> tag by
// internal/ui/export.go, alongside the vendor marked/highlight.js globals it
// reads from window. No code splitting, no manifest, no dynamic imports — the
// snapshot must run from a single file with no server.
export default defineConfig({
  build: {
    outDir: 'dist-export',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/export/export-entry.js'),
      formats: ['iife'],
      name: 'PiExport',
      fileName: () => 'export.js',
    },
    minify: true,
  },
});
