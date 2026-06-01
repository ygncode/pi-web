# UI Rendering & Frontend Architecture (`internal/ui/` and `web/`)

This document explains the unified architecture of our HTML template layouts, stylesheet subsystems, and Vite-built frontend runtimes. 

## Short Version

| Layer / Directory | Purpose |
|-------------------|---------|
| `web/` | **Client Runtime Source** — Vite-managed ES modules compiled into production assets (`web/dist/`) and served as `/static/assets/...` |
| `internal/ui/live_templates/` | **Unified HTML Shells & Style Tokens** — Core Go-embedded template shells (`session.html`, `index.html`) and split theme stylesheets (`styles/theme.css`, `session.css`, `menu.css`, `palette.css`, `index.css`) |

---

## 🎨 Unified Layout Architecture (Single HTML Shell)

Historically, this codebase maintained separate template layouts for the **Live Local App** and **Standalone Gist Exports**. They are now unified under one robust, flexible layout engine:

- **Unified Template File**: `internal/ui/live_templates/session.html`
- **CSS Stylesheets** (split by concern, concatenated inline for session page):
  - `styles/theme.css` — CSS custom properties / theme variables
  - `styles/session.css` — session page layout, tree, chat, message rendering
  - `styles/menu.css` — command menu / context menu
  - `styles/palette.css` — session search palette
- **Index page** loads `/theme.css`, `/index.css`, `/menu.css`, `/palette.css` as separate stylesheet links
- **Export page** inlines only `theme.css` + `session.css` (no menus/palettes needed)

By using Go's `html/template` conditional checks (`{{if .IsLive}} ... {{else}} ... {{end}}`), the same layout shell dynamically adapts to serve both environments:

| Feature / UI Component | Live App (`/session`) | Standalone Export (Share Gist) |
|------------------------|------------------------|-------------------------------|
| **Go Renderer** | `internal/ui/session_page.go` | `internal/ui/export.go` |
| **HTML Layout Shell** | `live_templates/session.html` (`IsLive: true`) | `live_templates/session.html` (`IsLive: false`) |
| **Styling Stylesheet** | `live_templates/styles/theme.css` + `session.css` + `menu.css` + `palette.css` | `live_templates/styles/theme.css` + `session.css` |
| **Theme Cycling Menu** | Yes (Desktop/Mobile dropdowns) | No (Top-right standalone toggle) |
| **Back Link & popover** | Yes (Desktop command menus) | No |
| **Chat Composer** | Yes (Server-plumbed input composer) | No |
| **Javascript Delivery**| Vite script modules (`/static/assets/...`)| Embedded inline IIFE (marked + highlight + runtime)|
| **Network Requirements**| Yes (Requires local Go RPC server) | No (Fully standalone, serverless HTML)|

---

## 🛠️ Unified CSS Variables Theme Engine

Our styling is based on a **Unified CSS Custom Properties (Variables) design system** in `styles/session.css`. 

In both Live and Export environments, changing the theme simply toggles the `data-theme` attribute on the `<html>` root node:
- **Obsidian Dark** (`dark`)
- **Warm Linen Light** (`light`)
- **Arctic Frost Nord** (`nord`)
- **Cyberpunk Dracula** (`dracula`)
- **User Custom taste** (`custom` — serves custom colors loaded from `~/.pi/agent/pi-web/custom-themes.css`)

For export snapshots, the `exportThemeBootScript()` inlines a highly optimized theme toggle and cookie/localStorage boot engine that stays completely active.

---

## 🚀 Shared Code & Remaining Separation

While our layouts and styling are consolidated:
1. **Client Runtimes** remain separated by environment requirements:
   - Live app (`web/src/session/`): Handles SSE dynamic watchers, real-time message streams, chat composition, and service worker push updates.
   - Export app (`internal/ui/live_templates/export/app/*.js`): Performs static offline client rendering for tree building and list filters.
2. **Icons & Favicons**:
   - The live app loads dynamic vector files from `/icon.svg`.
   - The standalone export snapshot embeds a self-contained base64-encoded SVG favicon so it displays beautifully on all platforms without external network requests.
