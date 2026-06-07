# pi-web — Agent Context

pi-web is a local Go HTTP server that renders [pi](https://pi.dev) coding agent sessions in the browser. It reads JSONL session files from `~/.pi/agent/sessions/`, serves them with a dark-themed UI, and enables browser-based chat continuation via headless `pi --mode rpc` workers.

## Docs to Read First

Before making structural changes, read the relevant doc in `docs/`:

| If you're... | Read |
|---|---|
| New to the codebase | `docs/architecture/system-overview.md` |
| Changing frontend build/template embedding | `docs/dev/templates-vs-web.md` |
| Working on chat, SSE, or live-reload | `docs/sequence-flows/chat.md`, `docs/sequence-flows/live-reload.md` |
| Working on artifacts | `docs/sequence-flows/artifacts.md` |
| Working on annotations | `docs/sequence-flows/annotations.md` |
| Working on the @mention path autocomplete | `docs/sequence-flows/mention-autocomplete.md` |
| Working on btw floating scratch-chats | `docs/sequence-flows/btw.md` |
| Working on export/share | `docs/sequence-flows/share.md` |
| Working on the worker metrics dashboard | `docs/dev/metrics-dashboard.md` |
| Writing or debugging E2E / browser tests | `docs/dev/e2e-testing.md` |

The most important doc for frontend work is **`docs/dev/templates-vs-web.md`**. The live app is a **Svelte 5 SPA** (`web/src/`) served through a single Go-embedded shell (`internal/ui/embedded/app.html`); export/share is a separate static snapshot rendered from `internal/ui/embedded/session.html`. The export bundle is built by Vite from `web/src/export/export-entry.js`, which **reuses the live session modules** in `web/src/session/` — there is no longer a hand-maintained parallel copy.

## Tech Stack

- **Backend:** Go 1.25+ (`fsnotify`, `x/sys`)
- **Frontend:** Svelte 5 SPA (reactive `SessionDataModel`; the session viewer is fully component-driven), Vite, Vitest + `@testing-library/svelte` + jsdom
- **Session data:** JSONL from `~/.pi/agent/sessions/`; pi-web normally treats existing files as read-only, except it appends a `session_info` metadata line for browser rename and for auto-titling (the latter marked `autoTitle:true`). New-session creation writes a fresh JSONL file with a header and optional implicit model/thinking entries.
- **Live updates:** SSE driven by `fsnotify` file watchers
- **Auth:** `PI_WEB_TOKEN` required for non-loopback binds (e.g. Tailscale)

## Architecture

### Backend (`internal/`)
| Package | Purpose |
|---------|---------|
| `server` | HTTP handlers, SSE plumbing, file watcher, chat orchestration (incl. btw scratch-chats, auto-titling, metrics, push) |
| `sessions` | JSONL parsing, caching, lookup by ID, new-session/fork/clone creation |
| `auth` | Token middleware (`Authorization: Bearer`, `X-Pi-Token`, `?token=` cookie) |
| `workers` | Per-session `pi --mode rpc` lifecycle (spawn, reuse, reap, crash recovery) |
| `rpc` | Subprocess wrapper + streaming previews |
| `share` | Export a session to a private GitHub Gist via the `gh` CLI (`Runner` interface) |
| `git` | Low-level git queries used by `/api/git/*` (branch info, rename) |
| `files` | Bounded filesystem walk backing the `@mention` autocomplete (`GET /api/files`) |
| `updater` | Self-update version/changelog checks (powers `/api/version`, `/api/check-update`) |
| `render` | Tiny shared HTTP/render helpers (Vite manifest lookup, JSON responses) |
| `frontend` | Vite output embedding + manifest parsing + static asset serving |
| `agentdir` | Resolves the `~/.pi/agent` base directory |
| `ui` | Live SPA shell + export-snapshot rendering (see Key Files) |

### Frontend

The live UI is a Svelte 5 SPA. `web/src/main.js` mounts `App.svelte` into `#spa-root`; `App.svelte` routes by `window.location.pathname` (`/`, `/session`, `/settings`, `/login`) and mounts shared live chrome such as `VersionController`. The app routes are Svelte-component-driven: `SessionsPage.svelte` owns the sessions index (list/cards, command palette, home menu, new-session/project modals, index-wide SSE status); `SettingsPage.svelte` hydrates settings and each `components/settings/*Settings.svelte` section owns its controls; `SessionPage.svelte` creates the reactive `SessionDataModel` (`session/data/session-data.svelte.js`), provides it via context, and renders the viewer as self-contained Svelte components (tree, the message pane `SessionContent`→`SessionEntry`→`ToolCall`, header, right sidebar + artifacts/annotations, chat composer, live reload, modals, btw, cat). There is no `session.js` orchestrator — its glue lives in `SessionPage`'s `onMount` plus `session/{session-globals,session-content-runtime,lazy-highlight}.js`. The runners/renderers (chat composer + selectors, live reload + its SSE/scroll/stats primitives, the entry renderer) have been absorbed into their components; `session/chat/` + `session/live/` now hold only pure/shared helpers (`chat-api`, `git-api`, `chat-selectors`, `done-notifier`, `chat-preview`).

| Directory | Purpose |
|-----------|---------|
| `web/src/main.js`, `web/src/App.svelte` | SPA entry + client-side router |
| `web/src/routes/` | Page components: `SessionsPage`, `SessionPage`, `SettingsPage`, `LoginPage` |
| `web/src/components/` | Extracted Svelte UI: `session/`, `index/`, `settings/`, `shared/` |
| `web/src/index/` | Pure sessions-index helpers (normalization, grouping/filtering, API wrappers); `SessionsPage.svelte` drives the UI |
| `web/src/session/` | Session-viewer support: reactive `data/session-data.svelte.js` model, pure `tree/`/`render/`/`navigation/` helpers, the relocated live glue (`session-globals.js`, `session-content-runtime.js`, `lazy-highlight.js`), and pure/shared `chat/` + `live/` helpers. Orchestrated by `SessionPage.svelte` (no `session.js`) |
| `web/src/session/chat/` | Pure/shared chat helpers: `chat-api`/`git-api` (fetch), `chat-selectors` (pure model/thinking logic), `done-notifier` (notification/sound/push, shared with settings). The composer runtime + the model/thinking/slash/`@mention` selectors live in `ChatComposer.svelte`'s `<script module>` (`@mention` backed by `GET /api/files`) |
| `web/src/session/artifacts/` | Artifact registry (path-keyed files + fenced snippets) + right-sidebar Artifacts panel (preview/source, help modal) |
| `web/src/session/annotations/` | Inline review annotations (offset-anchored highlights, Annotations tab, send-to-pi); synced via the `annotations` SSE event |
| `web/src/shared/` | API helpers, escape, storage, status events, pure version helpers; shared UI lives in `components/shared/` |
| `internal/ui/embedded/` | Go-embedded resources: SPA shell (`app.html`), export template (`session.html`), auth prompt (`auth.html`), PWA assets, shared CSS |
| `web/src/export/` | Static-snapshot Vite entry (`export-entry.js`) — reuses `web/src/session/` rendering modules, omits all live/chat/SSE code |
| `internal/ui/embedded/export/` | Built snapshot bundle (`export.js`, generated by `npm run build:export`) + inlined `vendor/` scripts for Gist snapshots (no server, no chat, no SSE) |

### Key Files
- `cmd/pi-web/main.go` — tiny CLI entrypoint and build-time version variable
- `internal/app/app.go` — CLI flags, Tailscale auto-detect, dependency wiring
- `internal/frontend/assets.go` + `web/assets_embed.go` — Vite output embedding, manifest parsing, static asset serving
- `internal/ui/spa_page.go` — **Live app** SPA shell rendering (`RenderAppShell` → `internal/ui/embedded/app.html`); returned for all browser routes
- `internal/ui/session_page.go` — Export-snapshot payload prep + large-session truncation constants (consumed by `export.go`; not the live app)
- `internal/ui/export.go` — **Export/share snapshot** rendering (using `internal/ui/embedded/session.html`, inlines the built `export.js` + `vendor/`, no server deps)
- `internal/ui/embedded/styles/session.css` — Live session & export CSS
- `internal/server/metrics.go` + `internal/server/metrics_dashboard.html` — Worker metrics dashboard: `/api/metrics` JSON (process + per-worker CPU/RSS via gopsutil) and the self-contained `/metrics` page
- `.pi/extensions/pi-web.ts` — Pi extension with `/pi-web`, `/pi-web token`, `/pi-web set-token`, `/remote`, `/refresh` commands

### Live App vs. Export — DO NOT MIX THESE UP

| | Live App (`/`, `/session`, `/settings`) | Export/Share (Gist) |
|---|---|---|
| Go file | `internal/ui/spa_page.go` (`RenderAppShell`) | `internal/ui/export.go` |
| HTML | `internal/ui/embedded/app.html` (SPA shell) | `internal/ui/embedded/session.html` (`exportSessionTmpl`) |
| JS source | Svelte SPA: `web/src/main.js` → `App.svelte` → `routes/` + `components/`, driving the `web/src/session/` runtimes (Vite) | `web/src/export/export-entry.js` (reuses `web/src/session/`), built → `internal/ui/embedded/export/export.js` + `vendor/` |
| CSS | `internal/ui/embedded/styles/session.css` (inlined via `appStylesheets()`) | `internal/ui/embedded/styles/session.css` (inlined) |
| Chat composer | Yes (`web/src/components/session/ChatComposer.svelte`) | No |
| SSE/API calls | Yes | No |
| Needs server? | Yes | No — fully self-contained |

**Never** inject live-only chrome (Vite/Svelte scripts, active composer, SSE) into the export snapshot output. They are dynamic features that require a live Go backend.

## Build & Test

```bash
make setup      # npm install + go mod download
make dev        # Vite watcher + Go hot-reload (air)
make test       # vitest + go test ./...
make build      # frontend-build + go build -o pi-web
make check      # test + build + vet
make e2e-setup  # one-time: install e2e deps + Playwright browsers
make e2e        # build binary + run Playwright E2E (not part of test/check)
```

**Critical:** `go build ./cmd/pi-web` requires `web/dist` **and** `internal/ui/embedded/export/export.js` to exist first because of `//go:embed`. Both are generated by the frontend build (`npm run build` runs the live build then `build:export`). Always run `make build`, never `go build` alone.

### Local development — do NOT rely on a launchd agent

For development, start pi-web with `make dev` (Vite watcher + Go hot-reload) or run the freshly built `./pi-web` binary directly. Do **not** depend on a macOS LaunchAgent (e.g. `~/Library/LaunchAgents/com.pi-web.plist`) to run it — a `KeepAlive` agent pins port `31415` to the installed `~/.pi/agent/bin/pi-web` binary and will auto-respawn the old build, masking your local changes. If such an agent exists, unload it (`launchctl bootout gui/$(id -u)/com.pi-web`) and remove the plist before developing.

## Testing

- **Go:** Table-driven tests in `*_test.go` alongside source
- **Frontend:** Tests next to source (`foo.js` → `foo.test.js`). DOM helpers accept `{ documentImpl, windowImpl }` for testability
- **E2E (Playwright):** Lives in `e2e/`, runs against the built binary across desktop + mobile + iPad browsers. Chat uses a stub `pi`; fixtures are sanitized real sessions. Kept out of `make test`/`make check` (needs browsers + the server). See `docs/dev/e2e-testing.md`.

## Coding Standards

- **Go:** Small focused packages; `internal/server` is the HTTP glue exception. Avoid global state — `internal/app/app.go` wires `server.New(server.Deps{...})`. Use sentinel errors. `WriteTimeout` stays 0 for SSE.
- **JS:** ES modules. Explicit DI (`documentImpl`, `windowImpl`) over globals. The export snapshot reuses the live `web/src/session/` modules via `web/src/export/export-entry.js` and is rebuilt by Vite — no manual copy to keep in sync. Keep rendering modules side-effect-free on import and DI-pure so they stay safe to bundle into the server-less export.
- **CSS:** both live styling and export styling are in `internal/ui/embedded/styles/session.css`. Keep visual changes clean and unified.
- **Icons:** use [Lucide](https://lucide.dev) icons — **do not hand-draw custom SVG icons or use unicode glyphs** (`✕`, `⋯`, `⛶`, etc.) for UI icons. In JS/Svelte, import the icon and render it via the helper in `web/src/shared/icons.js`: `{@html icon(PanelLeft, { size: 14 })}` (Svelte) or `el.innerHTML = icon(X, { size: 13 })` (vanilla JS). Add new icons to the import/export lists in `icons.js`. For Go templates (the export `session.html`), paste the raw Lucide SVG markup. The helper renders to an SVG string so it works in Svelte, vanilla-JS `innerHTML`, and the server-less export bundle alike. (Exempt — these are typography/status, not icons: keyboard key/modifier hints like `⌘K`, `⌃`, and `↑↓ navigate`; the running-status dot `●`; and compact token-count notation like `↑1.2k` / `↓500`.)
- **i18n:** user-facing UI strings go through `t('key', params)` from `web/src/shared/i18n.js` (works in Svelte `{t('key')}` and vanilla-JS `el.textContent = t('key')`). Add new keys to `web/src/shared/locales/en.js` (the source of truth + fallback) first, then translate in every other built-in locale: `es/fr/de/zh/ja` plus the ASEAN set `id/ms/vi/th/fil/my/km/lo`. Built-ins are registered in `i18n.js` (`BUILTIN`). Locale is the `pi-web:v1:locale` setting (default English); changing it reloads. Users can add/override languages from Settings → Language (`pi-web:v1:custom-languages`). Session **content** (the conversation) is data and is never translated; the Go-rendered export/auth chrome stays English.

## Critical Rules

1. **Live app and export are separate renders.** The live app is the Svelte SPA served through the `internal/ui/embedded/app.html` shell (`spa_page.go`); export/share is a static snapshot rendered from `internal/ui/embedded/session.html` (`export.go`). Keep them distinct — never leak live-only chrome (SPA scripts, SSE, chat) into the export output.
2. **Export reuses the live source.** The static snapshot is built from `web/src/export/export-entry.js`, which imports the same `web/src/session/` rendering modules as the live app — fix rendering bugs once. Do not reintroduce a hand-maintained `export/app/*.js` copy. A guard test (`TestExportBundleIsSelfContained`) fails if a live-only module (SSE/chat) leaks into the export bundle.
3. **Existing session data is append-only for `session_info`.** Browser chat goes to a `pi --mode rpc` worker, which writes conversation entries. pi-web otherwise watches and broadcasts; its only direct writes to existing session files are appending `session_info` — for browser rename, and for auto-titling (marked `autoTitle:true`, see `internal/server/auto_title.go`). New-session creation may write initial implicit `model_change` / `thinking_level_change` entries in the fresh file.
4. **One worker per session.** Reused for subsequent messages. Crashed = evicted + replaced. Idle workers reaped after 10 min.
5. **SSE topics:** `globalSessID = "__all__"` for index-wide events; session ID for per-session events.
6. **Default port:** `31415`. State file: `~/.pi/agent/pi-web/pi-web-state.json`.
