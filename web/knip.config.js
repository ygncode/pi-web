/** @type {import('knip').KnipConfig} */
export default {
  exclude: ['exports', 'types', 'nsExports', 'nsTypes', 'enumMembers', 'namespaceMembers'],
  entry: ['src/main.js', 'src/export/export-entry.js', 'src/**/*.test.js'],
  project: ['src/**/*.{js,svelte}', '*.config.js'],
  // @pierre/diffs is loaded only via `import('@pierre/diffs')` inside
  // DiffModal.svelte. Knip's Svelte parser falls over on that file once it
  // carries enough $state / $derived runes (the dynamic import vanishes from
  // its dependency graph), so list the dep explicitly here.
  ignoreDependencies: ['@pierre/diffs'],
};
