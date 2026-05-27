# pi-web — Agent Context

pi-web is a local Go HTTP server that renders [pi](https://pi.dev) coding agent sessions in the browser. It reads JSONL session files from `~/.pi/agent/sessions/`, serves them with a dark-themed UI, and enables browser-based chat continuation via headless `pi --mode rpc` workers.

## Docs to Read First

Before making structural changes, read the relevant doc in `docs/`:

| If you're... | Read |
|---|---|
| New to the codebase | `docs/architecture/system-overview.md` |
| Changing frontend build/template embedding | `docs/dev/templates-vs-web.md` |
| Working on chat, SSE, or live-reload | `docs/sequence-flows/chat.md`, `docs/sequence-flows/live-reload.md` |
| Working on export/share | `docs/sequence-flows/share.md` |

The most important doc for frontend work is **`docs/dev/templates-vs-web.md`** — it explains the split between `web/` (live Vite app), `live_templates/` (Go-embedded HTML shells), and `export/` (self-contained snapshots for Gists). Getting this wrong means changing the wrong files.

## Tech Stack

- **Backend:** Go 1.25+ (`fsnotify`, `x/sys`)
- **Frontend:** Vanilla JS, Vite, Vitest + jsdom
- **Session data:** JSONL from `~/.pi/agent/sessions/`; pi-web normally treats existing files as read-only, except browser rename appends a `session_info` metadata line. New-session creation writes a fresh JSONL file with a header and optional implicit model/thinking entries.
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
| `web/src/shared/` | API helpers, escape, storage, status events |
| `live_templates/` | Go-embedded HTML shells for index/session pages |
| `export/` | Self-contained HTML/CSS/JS for Gist snapshots (no server, no chat, no SSE) |

### Key Files
- `main.go` — CLI flags, Tailscale auto-detect, dependency wiring
- `dist_embed.go` — `//go:embed all:web/dist` (Vite output embedded into binary)
- `session_page.go` — **Live session page** rendering (`live_templates/session.html`, chat composer)
- `export.go` — **Export/share snapshot** rendering (`export/index.html`, inlined JS, no server deps)
- `live_templates/session.css` — Live session page CSS
- `export/template.css` — Export snapshot CSS
- `.pi/extensions/pi-web.ts` — Pi extension with `/pi-web`, `/remote`, `/refresh` commands

### Live App vs. Export — DO NOT MIX THESE UP

| | Live App (`/session`) | Export/Share (Gist) |
|---|---|---|
| Go file | `session_page.go` | `export.go` |
| HTML shell | `live_templates/session.html` | `export/index.html` |
| JS source | `web/src/session/` (Vite) | `export/app/*.js` + `export/vendor/` |
| CSS | `live_templates/session.css` | `export/template.css` |
| Chat composer | Yes (`live_templates/chat_composer.html`) | No |
| Action buttons | Yes (baked into `live_templates/session.html`) | No |
| SSE/API calls | Yes | No |
| Needs server? | Yes | No — fully self-contained |

**Never** use `export/index.html` for the live session page. **Never** inject live-only chrome (buttons, chat) into `export/index.html`. They are separate templates for a reason.

## Build & Test

```bash
make setup    # npm install + go mod download
make dev      # Vite watcher + Go hot-reload (air)
make test     # vitest + go test ./...
make build    # frontend-build + go build -o pi-web
make check    # test + build + vet
```

**Critical:** `go build` requires `web/dist` to exist first because of `//go:embed`. Always run `make build`, never `go build` alone.

## Testing

- **Go:** Table-driven tests in `*_test.go` alongside source
- **Frontend:** Tests next to source (`foo.js` → `foo.test.js`). DOM helpers accept `{ documentImpl, windowImpl }` for testability

## Coding Standards

- **Go:** Small focused packages; `internal/server` is the HTTP glue exception. Avoid global state — `main.go` wires `server.New(server.Deps{...})`. Use sentinel errors. `WriteTimeout` stays 0 for SSE.
- **JS:** ES modules. Explicit DI (`documentImpl`, `windowImpl`) over globals. Keep `live_templates/` manually in sync with `web/src/session/live/` changes.
- **CSS:** live styling is in `live_templates/session.css`; export styling is in `export/template.css`. Keep shared visual changes intentionally mirrored when both products need them.

## Critical Rules

1. **Live and export are separate products.** `live_templates/session.html` is for the live app. `export/index.html` is for Gist snapshots. Do not mix them.
2. **Always keep `live_templates/` in sync** with `web/src/session/live/` changes.
2. **Existing session data is append-only for rename.** Browser chat goes to a `pi --mode rpc` worker, which writes conversation entries. pi-web otherwise watches and broadcasts; its only direct write to existing session files is appending `session_info` for browser rename. New-session creation may write initial implicit `model_change` / `thinking_level_change` entries in the fresh file.
3. **One worker per session.** Reused for subsequent messages. Crashed = evicted + replaced. Idle workers reaped after 10 min.
4. **SSE topics:** `globalSessID = "__all__"` for index-wide events; session ID for per-session events.
5. **Default port:** `31415`. State file: `~/.pi/agent/pi-web/pi-web-state.json`.
