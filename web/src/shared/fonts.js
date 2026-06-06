/**
 * Font registry + helpers shared by the settings UI.
 *
 * A stored font value is either a curated keyword ("mono"/"system"/"sans"/
 * "serif") or a raw family name the user typed or picked from their installed
 * fonts (via the Local Font Access API). Keywords resolve to a full CSS stack;
 * raw families are sanitized, quoted, and given the monospace stack as a
 * fallback. Kept in sync with the Go side in internal/server/settings.go (the
 * server injects the same resolved values into the HTML shell so pages paint
 * with the chosen fonts/sizes before any JS runs).
 */

export const FONT_UI_KEY = 'pi-web:v1:font-ui';
export const FONT_CONTENT_KEY = 'pi-web:v1:font-content';
export const FONT_CODE_KEY = 'pi-web:v1:font-code';
export const FONT_UI_SIZE_KEY = 'pi-web:v1:font-ui-size';
export const FONT_CONTENT_SIZE_KEY = 'pi-web:v1:font-content-size';

export const FONT_MIN_SIZE = 8;
export const FONT_MAX_SIZE = 32;

export const FONT_KEYWORDS = {
  mono: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  sans: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
};

// Strip a raw family name to a safe subset (letters, digits, spaces, hyphens).
export function sanitizeFontFamily(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9 -]/g, '')
    .trim()
    .slice(0, 64);
}

export function resolveFontStack(value) {
  if (FONT_KEYWORDS[value]) return FONT_KEYWORDS[value];
  const family = sanitizeFontFamily(value);
  if (!family) return FONT_KEYWORDS.mono;
  return `'${family}', ${FONT_KEYWORDS.mono}`;
}

export function clampSize(value, fallback = 12) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(FONT_MAX_SIZE, Math.max(FONT_MIN_SIZE, n));
}

/**
 * Apply font choices live by setting CSS custom properties on the root element
 * (inline element-level styles win over any stylesheet rule). Any field may be
 * omitted.
 */
export function applyFonts(documentImpl, { ui, content, code, uiSize, contentSize } = {}) {
  const root = documentImpl?.documentElement;
  if (!root || !root.style) return;
  if (ui) root.style.setProperty('--font-sans', resolveFontStack(ui));
  if (content) root.style.setProperty('--font-content', resolveFontStack(content));
  if (code) root.style.setProperty('--font-code', resolveFontStack(code));
  if (uiSize != null && uiSize !== '') root.style.setProperty('--font-size-ui', `${clampSize(uiSize)}px`);
  if (contentSize != null && contentSize !== '') root.style.setProperty('--font-content-size', `${clampSize(contentSize)}px`);
}
