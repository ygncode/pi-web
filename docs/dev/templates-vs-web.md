# UI Rendering & Frontend Architecture (`internal/ui/` and `web/`)

This document explains how the live Svelte SPA, Go-embedded shell, shared styles, and static export path fit together.

## Short Version

| Layer / Directory | Purpose |
|---|---|
| `web/` | Client runtime source — Svelte + Vite modules compiled into `web/dist/` and served as `/static/assets/...` |
| `internal/ui/embedded/app.html` | One Go-embedded live SPA shell for browser routes |
| `internal/ui/embedded/share-session.html` | Static export/share shell only; rendered with `IsLive: false` by `internal/ui/export.go` |
| `internal/ui/embedded/styles/` | Shared CSS tokens and page styles used by the SPA shell, PWA CSS routes, and export |

---

## Live App: One SPA Shell

The live app no longer uses separate Go-rendered `index.html`, `settings.html`, or live `session.html` pages. Browser routes are served by `internal/ui/spa_page.go`, which renders:

```txt
internal/ui/embedded/app.html
└── web/src/main.js  (Vite entry)
    └── web/src/App.svelte
        ├── routes/SessionsPage.svelte  (/)
        ├── routes/SessionPage.svelte   (/session?id=…)
        ├── routes/SettingsPage.svelte  (/settings)
        ├── routes/SchedulesPage.svelte (/schedules)
        └── routes/NotFoundPage.svelte  (any other path)
```

The Go shell intentionally preserves the current PWA-first boot path:

- no-zoom iPhone viewport metadata
- theme boot before first paint
- Window Controls Overlay boot
- manifest/icons/mobile-web-app metadata
- custom themes stylesheet
- server-backed font variables
- service worker registration
- Vite hashed SPA asset from `web/dist/.vite/manifest.json`

API, SSE, PWA, static asset, sound, and share routes remain server-handled.

---

## Stylesheets

The live SPA shell inlines the core CSS needed by all migrated routes:

- `styles/theme.css`
- `styles/index.css`
- `styles/settings.css`
- `styles/schedules.css`
- `styles/session.css`
- `styles/menu.css`
- `styles/palette.css`

The inlined CSS is the only delivery path for these files: `internal/ui/pwa.go` serves just the manifest, service worker, icons, and `cat.webm`. The one standalone stylesheet route is `/custom-themes.css` (user CSS).

The pre-auth token prompt is not part of the SPA shell: the auth middleware renders the standalone `embedded/auth.html` page (`internal/ui/auth_page.go`).

---

## Static / Share Export

Export/share snapshots are still fully self-contained and must not depend on the live Go backend.

| | Live App | Static Export |
|---|---|---|
| Go renderer | `internal/ui/spa_page.go` | `internal/ui/export.go` |
| HTML shell | `embedded/app.html` | `embedded/share-session.html` (`IsLive: false`) |
| JS source | `web/src/main.js` | `web/src/export/export-entry.js` |
| JS delivery | `/static/assets/app-*.js` | inline IIFE `internal/ui/embedded/export/export.js` |
| Network required | Yes | No |
| Chat/SSE | Yes | No |

Do not import live-only modules (SSE, chat, worker status, service-worker live glue) from the export entry. `TestExportBundleIsSelfContained` guards this.

---

## Current Migration State

The SPA owns all live browser routes. The **session viewer is fully Svelte-orchestrated**: `SessionPage.svelte` creates the reactive `SessionDataModel` (`session/data/session-data.svelte.js`), provides it via context, and renders the session UI as Svelte components (`SessionTree`, `SessionContent`, `SessionInfoHeader`, `RightSidebar` + `ArtifactPanel`/`AnnotationLayer`, `ChatComposer`, `LiveReload`, `CommandMenu`, the modals, `BtwPopup`, `CatGatekeeper`, …). There is **no `session.js` orchestrator anymore** — its glue was distributed into:

- `SessionPage.svelte`'s `onMount` (`startSessionPageRuntime()`): per-page bootstrap, `setupSessionUi`, content-runtime wiring, header handlers, initial `navigateTo`, annotation-layer init
- `session/session-globals.js`: page-global glue (keyboard shortcuts, done-notifier, visual-viewport/scroll) — returns a disposer
- `session/session-content-runtime.js`: the `afterRender` hook (toggle state + lazy highlight), the delegated copy/fork/label handler, and the download-JSONL action
- `session/lazy-highlight.js`: deferred `highlight.js` pass
- `SessionDataModel.reconcile()`: live-reload / load-earlier model reconciliation

The message pane itself is now Svelte components (`SessionContent` → `SessionEntry` → `ToolCall` → `ToolOutput`/`AskQuestion`), with `{@html}` used only for markdown + pre-rendered ANSI tool output. The former runner/renderer modules have been split between owning components and focused helpers: `ChatComposer.svelte` owns the composer runtime with live DOM helpers under `web/src/components/session/chat/`; `LiveReload.svelte` owns the live orchestration while `web/src/session/live/` owns connection/reconnect lifecycle, SSE/reload, follow-scroll, stats, and streaming-preview helpers; the entry renderer is the `<SessionEntry>` family. `web/src/session/chat/` holds pure/shared chat helpers (`chat-api`, `git-api`, `chat-selectors`, `done-notifier`). The static export reuses the same Svelte components via `web/src/export/export-entry.js`.

Phase 4 is complete: the index and settings routes are also Svelte-orchestrated. `SessionsPage.svelte` owns the sessions list, project/new-session modals, layout state, and index-wide SSE updates; `web/src/index/` contains pure data/API helpers only. `SettingsPage.svelte` hydrates settings once and each `components/settings/*Settings.svelte` section owns its controls. Shared live chrome such as the session-list command palette and version modal lives in Svelte components (`CommandPalette.svelte`, `VersionController.svelte`).
