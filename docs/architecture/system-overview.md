# System Overview

## What pi-web Does

pi-web is a local HTTP server that lets you browse and interact with your pi coding-agent sessions in a web browser. It scans `~/.pi/agent/sessions/`, renders a dark-themed UI, and supports live-reloading, chat continuation, and session sharing.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Go 1.25+ |
| Frontend (index) | Vite + vanilla JS |
| Frontend (session) | Vite + vanilla JS (Go renders only the HTML shell + initial data) |
| Static export | Go `html/template` + inlined JS/CSS (self-contained Gist) |
| Styling | Custom CSS (multi-theme: dark/light/nord/dracula/custom) |
| Live Updates | Server-Sent Events (SSE) |
| Chat RPC | JSONL over stdin/stdout via `pi --mode rpc` |
| Session Storage | JSONL files on disk; pi-web creates new session files and appends `session_info` for browser rename |
| Local DB | SQLite (`~/.pi/agent/pi-web.sqlite`) for per-project scratchpads, per-session review annotations, project visibility prefs, and server-backed user settings |
| Auth | Token cookie/query/header (optional on localhost) |

## Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                 Browser                                   │
│                                                                           │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────────────────┐  │
│   │ Index Page  │      │ Session Page│      │   EventSource Client    │  │
│   │  /index.js  │      │  (embedded) │      │      /events?id=…       │  │
│   │  vanilla JS │      │  marked.js  │      │                         │  │
│   │  highlight  │      │  highlight  │      │  • reload (session)     │  │
│   │             │      │  chat UI    │      │  • new-session (index)  │  │
│   │  Search     │      │  Share btn  │      │  • status-delta         │  │
│   │  New Sess   │      │  Model sel  │      │  • status-snapshot      │  │
│   │  Run badges │      │  Thinking   │      │                         │  │
│   └─────────────┘      └─────────────┘      └─────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                              HTTP Router                                  │
│                                                                           │
│   GET  /              →  handleIndex      (SPA shell)                    │
│   GET  /session       →  handleSession    (SPA shell)                    │
│   GET  /settings      →  handleSettingsPage (SPA shell)                  │
│   GET  /api/session   →  handleApiSession  (JSON)                        │
│   GET  /api/sessions  →  handleApiSessions (JSON list)                   │
│   POST /api/chat      →  handleChat        (multipart or JSON)           │
│   POST /api/chat/cancel → handleCancelChat                               │
│   POST /api/set-model →  handleSetModel                                  │
│   POST /api/set-thinking-level → handleSetThinkingLevel                  │
│   POST /api/new-session / fork-session / clone-session                   │
│   POST /api/rename-session → handleRenameSession                         │
│   GET  /api/models    →  handleAvailableModels                           │
│   GET  /api/worker-status → handleWorkerStatus                           │
│   GET  /api/git/info  / POST /api/git/rename-branch                      │
│   GET/POST /api/scratchpad → scratchpad (SQLite)                         │
│   GET/POST/DELETE /api/annotations → review annotations (SQLite, SSE)    │
│   GET/POST /api/settings → user settings (SQLite, write-through cache)   │
│   GET/POST /api/projects → project visibility prefs (SQLite)             │
│   GET  /api/sounds  /  GET /sounds/…   (notification sounds)             │
│   POST /share         →  handleShare         (GitHub Gist)               │
│   GET  /events        →  handleEvents        (SSE)                       │
│   GET  /api/recent-locations → handleRecentLocations                     │
│   GET  /custom-themes.css → handleCustomThemes                           │
│   /api/push/{vapid,subscribe,unsubscribe}  (web-push, optional)         │
│   /api/{version,check-update,update,restart} (self-update, optional)    │
│   PWA: /manifest.webmanifest, /sw.js, /icon.svg, /cat.webm, …           │
│   GET  /static/…      →  embedded Vite assets                            │
│                                                                           │
│   All handlers wrapped with auth.Middleware (token check)                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
   ┌──────────┐            ┌──────────────┐           ┌──────────────┐
   │ Sessions │            │    Chat      │           │   File       │
   │  Cache   │            │   Workers    │           │  Watchers    │
   │          │            │              │           │              │
   │ LoadAll  │            │ Manager      │           │ fsnotify     │
   │ ParseFile│            │  ├─ worker   │           │  ├─ debounce │
   │ Resolve  │            │  ├─ reap     │           │  └─ fallback │
   │ Create   │            │  └─ status   │           │ polling      │
   └──────────┘            └──────────────┘           └──────────────┘
                                    │
                                    ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                    External Processes                             │
   │                                                                   │
   │   pi --mode rpc          (per-session chat worker subprocess)     │
   │   gh gist create         (share session as private gist)          │
   │                                                                   │
   └──────────────────────────────────────────────────────────────────┘
```

## Network Binding

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   --host flag   │──────────────────────▶│  127.0.0.1      │
│   (override)    │                       │  (default)      │
└─────────────────┘                       └─────────────────┘
         │
         ▼
   Non-loopback →  PI_WEB_TOKEN required  (or --insecure)
   Loopback     →  Auth optional

When no --host override is supplied and Tailscale is running, pi-web also
configures Tailscale Serve:

    tailscale serve --bg --https=<port> http://127.0.0.1:<port>

Tailscale owns HTTPS/certificates and exposes the app at the node's MagicDNS
name, while pi-web itself continues listening only on localhost.
```

## Session Directory Layout

```
~/.pi/agent/
├── sessions/
│   ├── --project-name--/
│   │   ├── 2026-01-15T10-30-00.000Z_a1b2c3d4.jsonl
│   │   ├── 2026-01-15T11-00-00.000Z_e5f6g7h8.jsonl
│   │   └── …
│   └── --another--project--/
│       └── …
├── session-status/
│   ├── 2026-01-15T10-30-00.000Z_a1b2c3d4.jsonl   ← terminal writes here
│   └── …
├── pi-web.sqlite           ← scratchpads + annotations + project visibility prefs + user settings
└── pi-web/
    ├── pi-web-state.json   ← server state file
    ├── custom-themes.css   ← optional user custom theme
    ├── vapid.json          ← web-push VAPID keys (when push enabled)
    └── push-subs.json      ← web-push subscriptions (when push enabled)
```

## Project Visibility

Project filtering is an **opt-in master switch**, stored in the `app_settings`
SQLite table (`project_filter_enabled`, default **off**). Per-project enable
state lives in the `project_prefs` table. Both are server-side, so they sync
across devices. See `internal/server/projects.go`.

- **Filter off (default):** every session shows; new sessions (web- or
  terminal-created) appear immediately, exactly like before the feature existed.
- **Filter on:** the index only renders sessions whose project is **enabled** —
  an allowlist. Projects discovered after the table is first seeded default to
  hidden, so one-off folders stay out of view.
- **First seed** (empty `project_prefs`): every discovered project is enabled, so
  turning the filter on doesn't blank the homepage.
- **Registering** a folder path (`action: register`) pre-approves it so sessions
  that later land there show immediately, even before any session exists.
- Filtering is applied server-side in both `handleIndex` and `handleApiSessions`
  (no client flash) and is a no-op while the master switch is off. Manage via the
  index menu → **Manage Projects** (search, select/deselect-all, register, and the
  filter switch), backed by `GET/POST /api/projects`.

## Startup Order

1. Parse CLI flags (`-p`, `-host`, `-o`, `-insecure`, `-version`)
2. Validate sessions directory exists
3. Determine bind host (flag → localhost)
4. Enforce auth for explicit non-loopback binds
5. Build `server.Deps` (renderers, cache, workers, auth)
6. Create `Server` → starts file watcher + status watcher + sweeper
7. Register routes on `http.ServeMux`
8. Load Vite manifest and register static assets
9. Optionally configure Tailscale Serve HTTPS for localhost
10. Write state file to `~/.pi/agent/pi-web/pi-web-state.json` (with flock)
11. Optionally open browser
12. Warm models cache (async)
13. Start `http.Server` with timeouts; graceful shutdown on `SIGINT`/`SIGTERM`
