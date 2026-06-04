/**
 * artifact-filter.js — pure, DOM-free filtering of artifact descriptors by the
 * user's Artifacts settings.
 *
 * The registry (artifact-registry.js) always detects *everything*; this module
 * narrows that list down to what the user wants to see:
 *
 *   - `enabled === false` → show nothing (session.js also hides the whole tab).
 *   - empty `include` list → show everything (all files + chat snippets).
 *   - non-empty `include` list → keep file artifacts whose path matches a
 *     pattern, and DROP chat snippets (they have no path to match against).
 *
 * Patterns are simple globs, not gitignore syntax:
 *   - a pattern with no `/` matches the artifact's basename (`*.md`, `*.html`)
 *   - a pattern containing `/` matches the full path (`artifacts/**`, `docs/*.md`)
 *   - `*`  → any run of non-slash characters
 *   - `**` → any characters (including slashes)
 *   - a bare extension token (`.md`) is normalized to `*.md`
 *
 * Kept DOM-free and side-effect-free for isolated unit testing, mirroring
 * artifact-registry.js.
 */

const ENABLED_KEY = 'pi-web:v1:artifacts:enabled';
const INCLUDE_KEY = 'pi-web:v1:artifacts:include';

// localStorage keys that should re-run the filter when changed in another tab.
export const ARTIFACT_SETTING_KEYS = [ENABLED_KEY, INCLUDE_KEY];

// JS-side fallbacks so the session page can paint synchronously before the
// server-backed settings (hydrateSettings) resolve. Mirrors settingDefaults in
// internal/server/settings.go.
const DEFAULT_ENABLED = true;
const DEFAULT_INCLUDE = '*.md, *.html';

/** Split a raw include string into normalized glob patterns. */
export function parsePatterns(str) {
  if (typeof str !== 'string') return [];
  return str
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('.') && !t.includes('/') ? `*${t}` : t));
}

function basename(filePath) {
  return filePath.split(/[\\/]/).pop() || filePath;
}

/** Compile one glob pattern to a RegExp anchored over the whole string. */
function globToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') { re += '.*'; i += 1; } // ** → any chars
      else re += '[^/]*';                                  // *  → non-slash run
    } else {
      re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

/** True if filePath matches any pattern (basename-scoped unless pattern has `/`). */
export function matchesPath(filePath, patterns) {
  if (typeof filePath !== 'string' || !filePath) return false;
  const base = basename(filePath);
  for (const pattern of patterns) {
    const target = pattern.includes('/') ? filePath : base;
    if (globToRegExp(pattern).test(target)) return true;
  }
  return false;
}

/**
 * Filter detected artifacts by the user's settings.
 * @returns {{visible: Array, hiddenCount: number}}
 */
export function filterArtifacts(artifacts, { enabled = true, include = '' } = {}) {
  const list = Array.isArray(artifacts) ? artifacts : [];
  if (enabled === false) return { visible: [], hiddenCount: 0 };

  const patterns = parsePatterns(include);
  if (patterns.length === 0) return { visible: list, hiddenCount: 0 };

  const visible = list.filter((a) => a && a.filePath && matchesPath(a.filePath, patterns));
  return { visible, hiddenCount: list.length - visible.length };
}

/**
 * Read the two artifact settings from storage with JS fallback defaults, so the
 * session page can filter synchronously on first paint.
 */
export function readArtifactSettings(storage) {
  let enabled = DEFAULT_ENABLED;
  let include = DEFAULT_INCLUDE;
  try {
    const e = storage?.getItem(ENABLED_KEY);
    if (e != null) enabled = String(e) === 'true';
    const inc = storage?.getItem(INCLUDE_KEY);
    if (inc != null) include = String(inc);
  } catch {
    // ignore storage availability errors; fall back to defaults
  }
  return { enabled, include };
}

export const __test__ = { globToRegExp, basename, DEFAULT_ENABLED, DEFAULT_INCLUDE };
