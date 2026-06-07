// Pure formatting helpers for rendering conversation entries. Extracted from
// session-entry-renderer.js during its decomposition into Svelte components
// (docs/dev/svelte-migration-plan.md). No DOM, no side effects.

export function formatTokens(count) {
  if (count < 1000) return count.toString();
  if (count < 10000) return (count / 1000).toFixed(1) + 'k';
  if (count < 1000000) return Math.round(count / 1000) + 'k';
  return (count / 1000000).toFixed(1) + 'M';
}

export function formatTimestamp(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function replaceTabs(text) {
  return String(text).replace(/\t/g, '   ');
}

// Coerce a value to a display string. Returns null for invalid (non-string,
// non-nullish) types so callers can show an "[invalid arg]" marker.
export function str(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return null;
}

export function getLanguageFromPath(filePath) {
  const ext = String(filePath).split('.').pop()?.toLowerCase();
  const extToLang = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
    php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql', html: 'html', css: 'css', scss: 'scss',
    json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml',
    md: 'markdown', dockerfile: 'dockerfile',
  };
  return extToLang[ext];
}

// Split text into the first `maxLines` preview lines + the remaining count.
export function splitOutputLines(text, maxLines) {
  const replaced = replaceTabs(text);
  const lines = replaced.split('\n');
  return { lines, preview: lines.slice(0, maxLines), remaining: lines.length - maxLines };
}
