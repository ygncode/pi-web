// Lucide icons (https://lucide.dev — ISC license). pi-web renders icon data to
// an SVG *string* rather than using a framework component, because icons are
// injected from three places: Svelte markup ({@html icon(...)}), vanilla-JS
// runtime modules (el.innerHTML = icon(...)), and — via the shared session
// modules — the server-less export bundle. A string helper works in all three
// and keeps the export self-contained.
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
