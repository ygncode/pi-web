import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportEntry = path.join(srcRoot, 'export', 'export-entry.js');

const forbidden = [
  'session/chat/',
  'session/live/',
  'session/session-globals.js',
  'components/session/ChatComposer.svelte',
  'components/session/LiveReload.svelte',
];

function normalize(file) {
  return path.relative(srcRoot, file).split(path.sep).join('/');
}

function resolveImport(specifier, importer) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.svelte`,
    path.join(base, 'index.js'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function importsFor(file) {
  const source = fs.readFileSync(file, 'utf8');
  const specs = [];
  const re = /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(source))) specs.push(match[1]);
  return specs;
}

function collectGraph(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    for (const specifier of importsFor(file)) {
      const resolved = resolveImport(specifier, file);
      if (resolved) stack.push(resolved);
    }
  }
  return Array.from(seen).map(normalize).sort();
}

describe('export source boundary', () => {
  it('does not import live-only session modules', () => {
    const graph = collectGraph(exportEntry);
    const leaks = graph.filter((file) => forbidden.some((prefix) => file.startsWith(prefix) || file === prefix));
    expect(leaks).toEqual([]);
  });
});
