// Lucide icons (https://lucide.dev — ISC license). pi-web renders icon data to
// an SVG *string* for Svelte markup ({@html icon(...)}) and export snapshots.
// Live utility modules that need to swap an icon imperatively can use
// setIconElement(), which builds an SVG node and replaces children without
// string-based view rendering.
//
// Do not hand-draw custom SVG icons or use unicode glyphs for icons. Import the
// Lucide icon here and render it with icon(). See AGENTS.md.
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  FileDiff,
  FolderGit2,
  Ghost,
  GitFork,
  Link2,
  ListTree,
  Loader,
  Maximize2,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  Snowflake,
  SquarePen,
  Sun,
  Tag,
  Terminal,
  TextQuote,
  X,
} from 'lucide';

// Lucide's default SVG presentation attributes (24x24 grid, 2px round strokes).
const DEFAULT_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

const attrString = (attrs) =>
  Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${String(v)}"`)
    .join(' ');

/**
 * Render a Lucide icon node to an SVG markup string.
 * @param {Array<[string, Record<string, string|number>]>} node Lucide icon data.
 * @param {{ size?: number, class?: string, strokeWidth?: number|string }} [opts]
 * @returns {string}
 */
export function icon(node, { size = 16, class: className = '', strokeWidth } = {}) {
  const attrs = {
    ...DEFAULT_ATTRS,
    width: size,
    height: size,
    'aria-hidden': 'true',
  };
  if (strokeWidth != null) attrs['stroke-width'] = String(strokeWidth);
  if (className) attrs.class = className;
  const children = node
    .map(([tag, childAttrs]) => `<${tag} ${attrString(childAttrs)} />`)
    .join('');
  return `<svg ${attrString(attrs)}>${children}</svg>`;
}

export function iconNode(node, { size = 16, class: className = '', strokeWidth, documentImpl = document } = {}) {
  const svg = documentImpl.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const attrs = {
    ...DEFAULT_ATTRS,
    width: size,
    height: size,
    'aria-hidden': 'true',
  };
  if (strokeWidth != null) attrs['stroke-width'] = String(strokeWidth);
  if (className) attrs.class = className;
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, String(v));
  for (const [tag, childAttrs] of node) {
    const child = documentImpl.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(childAttrs || {})) child.setAttribute(k, String(v));
    svg.appendChild(child);
  }
  return svg;
}

export function setIconElement(el, node, opts = {}) {
  if (!el) return;
  el.replaceChildren(iconNode(node, { ...opts, documentImpl: opts.documentImpl || el.ownerDocument || document }));
}

// Theme -> Lucide icon. Keep this in sync with the inlined theme-icon SVGs in
// the boot script (internal/ui/live_page.go), which paints the icon before the
// JS bundle loads — both must emit identical markup to avoid a swap on load.
const THEME_ICONS = {
  dark: Moon,
  light: Sun,
  nord: Snowflake,
  dracula: Ghost,
  custom: Settings,
};

/** SVG markup string for a theme's indicator icon. */
export function themeIcon(theme, opts = {}) {
  return icon(THEME_ICONS[theme] || THEME_ICONS.dark, { size: 14, ...opts });
}

export function setThemeIconElement(el, theme, opts = {}) {
  setIconElement(el, THEME_ICONS[theme] || THEME_ICONS.dark, { size: 14, ...opts });
}

export {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  FileDiff,
  FolderGit2,
  Ghost,
  GitFork,
  Link2,
  ListTree,
  Loader,
  Maximize2,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  Snowflake,
  SquarePen,
  Sun,
  Tag,
  Terminal,
  TextQuote,
  X,
};
