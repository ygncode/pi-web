# Frontend Architecture

pi-web uses a single Vite-built Svelte SPA embedded into the Go binary, plus a separate self-contained static export path.

## Vite App Frontend

Built with **Vite + Svelte + JavaScript modules**, embedded into the Go binary.

### Build Pipeline

```txt
web/src/main.js
web/src/App.svelte
web/src/routes/*.svelte
web/src/{components,routes,index,session,settings,shared}/**/*.{svelte,js}
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

`SessionsPage.svelte` owns the page shell and orchestrates Svelte components for the sessions list, session cards, command palette, home menu, new-session modal, and project management modal. `web/src/index/` now contains pure data/API helpers (`sessions.js`) for normalization, grouping, filtering, and API calls.

Data comes from existing APIs such as `/api/sessions`, `/api/new-session`, `/api/projects`, `/api/recent-locations`, and `/events?id=__all__`. Running-session status is pushed through the shared SSE helpers and reflected reactively in the cards/counts.

## Session Viewer (`/session?id=…`)

`SessionPage.svelte` owns the route, fetches session JSON from `/api/session?id=…`, and **orchestrates the whole viewer as Svelte components**. It creates the reactive `SessionDataModel` once, provides it via context, and exposes `navigateTo` + `__piReconcileEntries` + the content runtime on `window` before the child components mount. Its `onMount` runs `startSessionRuntime()` (bootstrap, `setupSessionUi`, content-runtime wiring, header handlers, initial nav, annotation init) and `setupSessionGlobals()` (page-global glue). There is **no `session.js` orchestrator** — see `docs/dev/templates-vs-web.md` § Current Migration State.

The message pane is rendered by Svelte components (no string-building renderer): `SessionContent` → `SessionEntry` → `ToolCall` → `ToolOutput`/`AskQuestion`, with `{@html}` used only for markdown + pre-rendered ANSI tool output. Other session UI components: `SessionTree`/`SessionTreeNodes`/`TreeNode`, `SessionInfoHeader`, `SessionHeader`, `RightSidebar` (+ `ArtifactPanel`, `AnnotationLayer`), `ChatComposer` (+ `GitFooter`), `LiveReload`, `CommandMenu`, `ImageModal`, the modals (`ShortcutsModal`/`ModelUsageModal`/`ForkModal`/`LabelModal`/`ShareDialog`), `BtwPopup`, `CatGatekeeper`. The runners/renderers (chat composer, the four selectors, live reload + its SSE/scroll/stats primitives, the entry renderer) have all been **absorbed into their components** — `web/src/session/` now holds only the reactive model, pure helpers, and a few shared utilities:

- `data/` — payload decoding + the reactive `SessionDataModel` (`session-data.svelte.js`, the single source of truth: entries/lookups/tree/active-path/view-state, `reconcile()`)
- `tree/`, `render/`, `navigation/` — **pure** tree/format/markdown/navigation helpers consumed by the Svelte components (and the export). The message renderer is now `<SessionEntry>`/`<ToolCall>`; `render/` keeps `session-format`, `markdown`, `entry-format`, `session-entry-actions` (download/share/copy)
- `session-globals.js`, `session-content-runtime.js`, `lazy-highlight.js` — the relocated live glue (see above)
- `chat/` — **pure helpers only**: `chat-api` + `git-api` (fetch wrappers), `chat-selectors` (pure model/thinking helpers), `done-notifier` (shared notification/sound/push util, also used by the settings page). The composer runtime + selectors live in `ChatComposer.svelte`'s `<script module>`
- `live/` — **`chat-preview.js` only** (the shared streaming-preview helper, used by `<LiveReload>` + `<BtwPopup>`). The live-reload runner + SSE/scroll/stats primitives live in `LiveReload.svelte`'s `<script module>`
- `ui/` — sidebar/search/toggle/session-ui-runner helpers used by `setupSessionUi` and `RightSidebar`
- `artifacts/`, `annotations/` — pure registries/filters/ranges + the fetch API wrappers; the panels themselves are `ArtifactPanel.svelte`/`AnnotationLayer.svelte`
- `cat-gatekeeper/` — pure timer/storage logic behind `CatGatekeeper.svelte`

The index + settings Phase 4 migration is complete: those routes are Svelte-orchestrated too, with only pure/API helpers left outside components.

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
- `web/src/shared/version.js` — pure version formatting/changelog/fetch helpers; `VersionController.svelte` owns the update modal/status UI
- `web/src/shared/keyboard-nav.js` — vim-style j/k/gg/G navigation
- `web/src/components/shared/CommandPalette.svelte` — shared ⌘K session search palette

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
