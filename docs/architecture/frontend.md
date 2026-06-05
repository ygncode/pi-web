# Frontend Architecture

pi-web uses a single Vite-built Svelte SPA embedded into the Go binary, plus a separate self-contained static export path.

## Vite App Frontend

Built with **Vite + Svelte + JavaScript modules**, embedded into the Go binary.

### Build Pipeline

```txt
web/src/main.js
web/src/App.svelte
web/src/routes/*.svelte
web/src/{index,session,settings,shared}/**/*.js
        │
        └──▶ vite build ──▶ web/dist/ ──▶ //go:embed
                              │
                              ▼
                         .vite/manifest.json
```

At startup, `internal/frontend/assets.go` + `web/assets_embed.go` reads `.vite/manifest.json`, validates the `src/main.js` SPA entrypoint, and registers its hashed asset route under `/static/...`. Other hashed chunks are served from the embedded `web/dist/assets/` filesystem.

## SPA Shell and Routes

The live app is hosted by `internal/ui/embedded/app.html`, rendered by `internal/ui/spa_page.go`. The shell preserves the PWA contract: viewport/no-zoom metadata, theme boot, Window Controls Overlay boot, font variables, custom themes, and service-worker registration.

Browser routes served by the SPA shell:

- `/` → `web/src/routes/SessionsPage.svelte`
- `/session?id=…` → `web/src/routes/SessionPage.svelte`
- `/settings` → `web/src/routes/SettingsPage.svelte`
- `/login` → `web/src/routes/LoginPage.svelte`

API, SSE, PWA, sound, and static asset routes remain server-handled and are not intercepted by the SPA fallback.

## Sessions Index (`/`)

`SessionsPage.svelte` owns the page shell and reuses the existing index runtime modules in `web/src/index/` for behavior:

- search/filter session cards
- new-session modal
- recent locations
- project management modal
- running-session live status via shared SSE helpers

Data comes from existing APIs such as `/api/sessions`, `/api/new-session`, `/api/projects`, `/api/recent-locations`, and `/events?id=__all__`.

## Session Viewer (`/session?id=…`)

`SessionPage.svelte` owns the route shell and fetches session JSON from `/api/session?id=…`. It currently reuses the legacy session runtime modules in `web/src/session/` for rendering, chat, live reload, sidebars, artifacts, and annotations.

Session frontend modules are split by ownership:

- `web/src/session/data/` — payload decoding, URL params, lookup maps
- `web/src/session/tree/` — tree building, filtering, flattening, tree DOM rendering
- `web/src/session/render/` — formatting helpers plus message/header renderers
- `web/src/session/navigation/` — session path rendering, header/message navigation, copy-link wiring
- `web/src/session/chat/` — chat composer, attachments, model and thinking controls
- `web/src/session/live/` — session SSE/live reload, fork modal, share overlay, command/session palettes, update indicator
- `web/src/session/ui/` — session page interaction wiring, sidebars, search filters
- `web/src/session/artifacts/` — artifact registry and right-sidebar Artifacts panel
- `web/src/session/annotations/` — inline review annotations and annotations SSE sync
- `web/src/session/cat-gatekeeper/` — cat gate overlay and settings

Future migration work should keep extracting these DOM-oriented modules into Svelte components without mixing live-only code into the export bundle.

## Static / Share Export

Export/share remains separate and self-contained. `web/src/export/export-entry.js` builds `internal/ui/embedded/export/export.js`, which is inlined by `internal/ui/export.go` with vendored `marked` and `highlight.js` assets.

Export rules:

- no Go server dependency
- no live SSE/chat imports
- no `/static/assets/...` dependency
- reusable rendering helpers may be shared with the live app when they are side-effect-free

## Live Reload

The session route listens to `/events?id=<sessionId>` via `web/src/session/live/` helpers for:

- `reload` / canonical session updates
- `chat-preview` streaming preview updates
- annotation snapshots

The index route listens to `/events?id=__all__` for `new-session`, `status-snapshot`, and `status-delta`.

## Shared Frontend Modules

- `web/src/shared/api.js` — JSON fetch helpers
- `web/src/shared/status-events.js` — shared status SSE lifecycle
- `web/src/shared/storage.js` — localStorage helpers
- `web/src/shared/escape.js` — HTML escaping
- `web/src/shared/theme.js` — theme toggle (dark/light/nord/dracula/custom)
- `web/src/shared/version.js` — version check + update indicator helpers
- `web/src/shared/keyboard-nav.js` — vim-style j/k/gg/G navigation
- `web/src/shared/session-list-palette.js` — shared ⌘K session search palette

## Static Assets

| Asset | Source | Served From |
|-------|--------|-------------|
| Vite SPA bundle | `web/dist/assets/app-*.js` | `/static/assets/app-*.js` |
| Vite lazy chunks | `web/dist/assets/*.js` | `/static/assets/*.js` |
| Static export JS | `internal/ui/embedded/export/export.js` + vendors | inline in exported HTML |
| Theme CSS | `internal/ui/embedded/styles/theme.css` | `/theme.css` (PWA route) |
| Index CSS | `internal/ui/embedded/styles/index.css` | `/index.css` (PWA route) |
| Session CSS | `internal/ui/embedded/styles/session.css` | inlined in SPA shell |
| Menu CSS | `internal/ui/embedded/styles/menu.css` | `/menu.css` and inlined in SPA shell |
| Palette CSS | `internal/ui/embedded/styles/palette.css` | `/palette.css` and inlined in SPA shell |
| Custom themes | `~/.pi/agent/pi-web/custom-themes.css` (optional) | `/custom-themes.css` |
| PWA manifest | `internal/ui/embedded/assets/manifest.webmanifest` | `/manifest.webmanifest` |
| Service worker | `internal/ui/embedded/assets/sw.js` | `/sw.js` |
| Icons | `internal/ui/embedded/assets/icon.svg` etc. | `/icon.svg`, `/icon-maskable.svg`, `/pi-logo.svg` |
| Sound assets | `internal/ui/embedded/assets/cat.webm` | `/cat.webm` |
| User sound assets | `~/.pi/agent/pi-web/assets/*.mp3` | `/sounds/*.mp3` |

## Theme System

The live SPA shell uses `theme.css`, `index.css`, `settings.css`, `session.css`, `menu.css`, and `palette.css` from `internal/ui/embedded/styles/`. The shell still injects the server-backed theme and font variables before the app starts so first paint matches the installed PWA theme without a flash.
