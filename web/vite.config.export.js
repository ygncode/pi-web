import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Builds the static export snapshot bundle as a single self-contained IIFE.
// The output (dist-export/export.js) is inlined verbatim into a <script> tag by
// internal/ui/export.go, alongside the vendor marked/highlight.js globals it
// reads from window. No code splitting, no manifest, no dynamic imports — the
// snapshot must run from a single file with no server.
//
// The svelte plugin is required so the export bundle can compile the SAME
// Svelte components the live app uses (Svelte migration, see
// docs/dev/svelte-migration-plan.md). Components carry no <style> blocks (all
// CSS lives in internal/ui/embedded/styles/session.css), so no CSS chunk is
// emitted — the snapshot stays a single JS file. TestExportBundleIsSelfContained
// guards against any live-only module leaking into this graph.
export default defineConfig({
  plugins: [svelte({ emitCss: false })],
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
