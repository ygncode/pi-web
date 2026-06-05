# UI Rendering & Frontend Architecture (`internal/ui/` and `web/`)

This document explains how the live Svelte SPA, Go-embedded shell, shared styles, and static export path fit together.

## Short Version

| Layer / Directory | Purpose |
|---|---|
| `web/` | Client runtime source — Svelte + Vite modules compiled into `web/dist/` and served as `/static/assets/...` |
| `internal/ui/embedded/app.html` | One Go-embedded live SPA shell for browser routes |
| `internal/ui/embedded/session.html` | Static export/share shell only; rendered with `IsLive: false` by `internal/ui/export.go` |
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
        └── routes/LoginPage.svelte     (/login)
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
- `styles/session.css`
- `styles/menu.css`
- `styles/palette.css`

Some CSS is also exposed as PWA/static routes by `internal/ui/pwa.go` (`/theme.css`, `/index.css`, `/menu.css`, `/palette.css`, `/settings.css`) for compatibility and install/offline behavior.

---

## Static / Share Export

Export/share snapshots are still fully self-contained and must not depend on the live Go backend.

| | Live App | Static Export |
|---|---|---|
| Go renderer | `internal/ui/spa_page.go` | `internal/ui/export.go` |
| HTML shell | `embedded/app.html` | `embedded/session.html` (`IsLive: false`) |
| JS source | `web/src/main.js` | `web/src/export/export-entry.js` |
| JS delivery | `/static/assets/app-*.js` | inline IIFE `internal/ui/embedded/export/export.js` |
| Network required | Yes | No |
| Chat/SSE | Yes | No |

Do not import live-only modules (SSE, chat, worker status, service-worker live glue) from the export entry. `TestExportBundleIsSelfContained` guards this.

---

## Current Migration State

The SPA owns all live browser routes, but some Svelte route shells still reuse existing DOM-oriented JavaScript modules:

- `web/src/index/` powers behavior for `SessionsPage.svelte`
- `web/src/settings/settings.js` powers behavior for `SettingsPage.svelte`
- `web/src/session/` powers rendering/chat/live behavior for `SessionPage.svelte`

Future cleanup should continue extracting these modules into focused Svelte components while keeping export-safe rendering helpers side-effect-free.
