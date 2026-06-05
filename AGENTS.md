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
| Working on export/share | `docs/sequence-flows/share.md` |
| Working on the worker metrics dashboard | `docs/dev/metrics-dashboard.md` |
| Writing or debugging E2E / browser tests | `docs/dev/e2e-testing.md` |

The most important doc for frontend work is **`docs/dev/templates-vs-web.md`** — it explains the unified rendering where `web/` provides the live Vite app, and `internal/ui/live_templates/` provides the Go-embedded shells and consolidated `export/` JS.

## Tech Stack

- **Backend:** Go 1.25+ (`fsnotify`, `x/sys`)
- **Frontend:** Vanilla JS, Vite, Vitest + jsdom
- **Session data:** JSONL from `~/.pi/agent/sessions/`; pi-web normally treats existing files as read-only, except it appends a `session_info` metadata line for browser rename and for auto-titling (the latter marked `autoTitle:true`). New-session creation writes a fresh JSONL file with a header and optional implicit model/thinking entries.
- **Live updates:** SSE driven by `fsnotify` file watchers
- **Auth:** `PI_WEB_TOKEN` required for non-loopback binds (e.g. Tailscale)

## Architecture

### Backend (`internal/`)
| Package | Purpose |
|---------|---------|
| `server` | HTTP handlers, SSE plumbing, file watcher, chat orchestration |
| `sessions` | JSONL parsing, caching, lookup by ID |
| `auth` | Token middleware (`Authorization: Bearer`, `X-Pi-Token`, `?token=` cookie) |
| `workers` | Per-session `pi --mode rpc` lifecycle (spawn, reuse, reap, crash recovery) |
| `rpc` | Subprocess wrapper + streaming previews |

### Frontend
| Directory | Purpose |
|-----------|---------|
| `web/src/index/` | Sessions list page (Vite) |
| `web/src/session/` | Session viewer — tree rendering, chat composer, live reload |
| `web/src/session/artifacts/` | Artifact registry (path-keyed files + fenced snippets) + right-sidebar Artifacts panel (preview/source, help modal) |
| `web/src/session/annotations/` | Inline review annotations (offset-anchored highlights, Annotations tab, send-to-pi); synced via the `annotations` SSE event |
| `web/src/shared/` | API helpers, escape, storage, status events |
| `internal/ui/live_templates/` | Go-embedded HTML shells for index/session pages |
| `internal/ui/live_templates/export/` | Self-contained JS/vendor scripts for static Gist snapshots (no server, no chat, no SSE) |

### Key Files
- `cmd/pi-web/main.go` — tiny CLI entrypoint and build-time version variable
- `internal/app/app.go` — CLI flags, Tailscale auto-detect, dependency wiring
- `internal/frontend/assets.go` + `web/assets_embed.go` — Vite output embedding, manifest parsing, static asset serving
- `internal/ui/session_page.go` — **Live session page** rendering (`internal/ui/live_templates/session.html`, chat composer)
- `internal/ui/export.go` — **Export/share snapshot** rendering (using `internal/ui/live_templates/session.html`, inlined JS, no server deps)
- `internal/ui/live_templates/styles/session.css` — Live session & export CSS
- `internal/server/metrics.go` + `internal/server/metrics_dashboard.html` — Worker metrics dashboard: `/api/metrics` JSON (process + per-worker CPU/RSS via gopsutil) and the self-contained `/metrics` page
- `.pi/extensions/pi-web.ts` — Pi extension with `/pi-web`, `/pi-web token`, `/pi-web set-token`, `/remote`, `/refresh` commands

### Live App vs. Export — DO NOT MIX THESE UP

| | Live App (`/session`) | Export/Share (Gist) |
|---|---|---|
| Go file | `internal/ui/session_page.go` | `internal/ui/export.go` |
| HTML shell | `internal/ui/live_templates/session.html` (`IsLive: true`) | `internal/ui/live_templates/session.html` (`IsLive: false`) |
| JS source | `web/src/session/` (Vite) | `internal/ui/live_templates/export/app/*.js` + `vendor/` |
| CSS | `internal/ui/live_templates/styles/session.css` | `internal/ui/live_templates/styles/session.css` |
| Chat composer | Yes (`internal/ui/live_templates/chat_composer.html`) | No |
| Action buttons | Yes (baked into `internal/ui/live_templates/session.html`) | No |
| SSE/API calls | Yes | No |
| Needs server? | Yes | No — fully self-contained |

**Never** inject live-only chrome (Vite scripts, active composer) into the export snapshot output. They are dynamic features that require a live Go backend.

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

**Critical:** `go build ./cmd/pi-web` requires `web/dist` to exist first because of `//go:embed`. Always run `make build`, never `go build` alone.

### Local development — do NOT rely on a launchd agent

For development, start pi-web with `make dev` (Vite watcher + Go hot-reload) or run the freshly built `./pi-web` binary directly. Do **not** depend on a macOS LaunchAgent (e.g. `~/Library/LaunchAgents/com.pi-web.plist`) to run it — a `KeepAlive` agent pins port `31415` to the installed `~/.pi/agent/bin/pi-web` binary and will auto-respawn the old build, masking your local changes. If such an agent exists, unload it (`launchctl bootout gui/$(id -u)/com.pi-web`) and remove the plist before developing.

## Testing

- **Go:** Table-driven tests in `*_test.go` alongside source
- **Frontend:** Tests next to source (`foo.js` → `foo.test.js`). DOM helpers accept `{ documentImpl, windowImpl }` for testability
- **E2E (Playwright):** Lives in `e2e/`, runs against the built binary across desktop + mobile + iPad browsers. Chat uses a stub `pi`; fixtures are sanitized real sessions. Kept out of `make test`/`make check` (needs browsers + the server). See `docs/dev/e2e-testing.md`.

## Coding Standards

- **Go:** Small focused packages; `internal/server` is the HTTP glue exception. Avoid global state — `internal/app/app.go` wires `server.New(server.Deps{...})`. Use sentinel errors. `WriteTimeout` stays 0 for SSE.
- **JS:** ES modules. Explicit DI (`documentImpl`, `windowImpl`) over globals. Keep `internal/ui/live_templates/` manually in sync with `web/src/session/live/` changes.
- **CSS:** both live styling and export styling are in `internal/ui/live_templates/styles/session.css`. Keep visual changes clean and unified.

## Critical Rules

1. **Live and export use a unified template.** `internal/ui/live_templates/session.html` serves both the live app and Gist snapshots. Do not split them.
2. **Always keep `internal/ui/live_templates/` in sync** with `web/src/session/ui/` changes when styling or structures shift.
3. **Existing session data is append-only for `session_info`.** Browser chat goes to a `pi --mode rpc` worker, which writes conversation entries. pi-web otherwise watches and broadcasts; its only direct writes to existing session files are appending `session_info` — for browser rename, and for auto-titling (marked `autoTitle:true`, see `internal/server/auto_title.go`). New-session creation may write initial implicit `model_change` / `thinking_level_change` entries in the fresh file.
4. **One worker per session.** Reused for subsequent messages. Crashed = evicted + replaced. Idle workers reaped after 10 min.
5. **SSE topics:** `globalSessID = "__all__"` for index-wide events; session ID for per-session events.
6. **Default port:** `31415`. State file: `~/.pi/agent/pi-web/pi-web-state.json`.
