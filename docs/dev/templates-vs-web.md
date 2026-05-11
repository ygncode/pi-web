# `export/`, `live_templates/`, and `web/`

> This repo used to put export files, live Go templates, vendored JS, and Vite-owned frontend code under one overloaded `templates/` directory. That split is now explicit.

## Short Version

| Directory | Purpose |
|-----------|---------|
| `web/` | The **live app runtime** — Vite-built ES modules served from `/static/assets/...` |
| `live_templates/` | Thin **live app HTML/template shells** embedded by Go |
| `export/` | The **standalone share/export app** — self-contained HTML/CSS/JS for Gist uploads |

## Live App

The live app is the browser UI served by the local Go server.

### Index page (`/`)

- Go renders `live_templates/index.html`.
- The template injects the Vite index module path via `indexScript`.
- The interactive code lives in `web/src/index/`.

### Session page (`/session?id=...`)

- The live session page and standalone export both go through `generateExportHtml`; with `showButtons=true`, it renders `live_templates/session.html` instead of `export/template.html`.
- Files used:
  - `live_templates/session.html`
  - `live_templates/session.css`
  - `live_templates/chat_composer.html`
- The page loads the Vite session module with `<script type="module" src="/static/assets/session-*.js">`.
- Interactive session behavior lives in `web/src/session/`.
- `export/app/*.js` is **not** used by the live session page.

### Live reload / SSE

- `web/src/session/live/live-reload.js` is bundled by the Vite session entrypoint while the SSE/live-update behavior is being decomposed into smaller modules.
- The live session page uses server APIs and SSE (`/events?id=...`) for reloads, chat previews, and running-state updates.

## Standalone Export / Share

The export is a frozen, server-independent session snapshot uploaded by the Share flow.

When you click **"↗ Share"**:

1. The server calls `generateExportHtml(session, false)`.
2. Go renders `export/template.html` with `export/template.css`.
3. Go inlines the export runtime JS:
   - `export/vendor/marked.min.js`
   - `export/vendor/highlight.min.js`
   - `export/app/*.js` concatenated in lexical order and wrapped in one IIFE
4. The resulting single `session.html` is uploaded as a private Gist with `gh gist create --public=false`.

The export intentionally has no chat composer, no SSE, no API calls, and no external asset dependency.

## Why the Split Exists

The live app and export are different products:

| | Live App | Export |
|---|---|---|
| Needs Go server? | Yes | No |
| Chat? | Yes | No |
| API/SSE? | Yes | No |
| JS delivery | Vite assets | Inline JS |
| State | Live/updating | Frozen snapshot |

Keeping separate directories makes ownership clear and avoids the old confusion where `templates/` looked like one thing but served two unrelated purposes.

## Remaining Duplication

There is still duplicated session rendering logic between:

- `web/src/session/` for the live app
- `export/app/*.js` for standalone exports

That duplication is deliberate for now. The next safe cleanup would be extracting small pure formatting/tree helpers that can be shared without forcing the export path to depend on live-only chat, SSE, or API behavior.
