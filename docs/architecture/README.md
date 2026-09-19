# Architecture Documentation

This directory contains the architecture documentation for **pi-web**, a local web viewer for pi coding-agent sessions.

## Documents

| Document | Description |
|----------|-------------|
| [system-overview.md](./system-overview.md) | High-level system architecture, component diagram, and tech stack |
| [backend.md](./backend.md) | Go backend: packages, responsibilities, and key types |
| [frontend.md](./frontend.md) | Frontend architecture: Svelte SPA, Vite build, embedded shell, and static export |
| [data-flow.md](./data-flow.md) | Session file format, data model, and storage layout |

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │ / /session  │  │ /settings   │  │      SSE /events            │  │
│  │ /schedules  │  │  Svelte SPA │  │   Live reload + status      │  │
│  │ Svelte SPA  │  │             │  │        updates              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ HTTP
┌─────────────────────────────────────────────────────────────────────┐
│                        pi-web HTTP Server                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │   Auth     │ │  Handlers  │ │   SSE      │ │  File Watcher    │  │
│  │Middleware  │ │  (server)  │ │ (events)   │ │ (fsnotify/poll)  │  │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │  Sessions  │ │  Workers   │ │   RPC      │ │  Share (gh)      │  │
│  │  (cache)   │ │  (manager) │ │  (pi CLI)  │ │  (gist create)   │  │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ filesystem
┌─────────────────────────────────────────────────────────────────────┐
│                    ~/.pi/agent/sessions/                             │
│         Project dirs  →  JSONL session files                         │
│         (--name--)        (timestamp_uuid.jsonl)                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Append-only session metadata**: pi-web reads from `~/.pi/agent/sessions/` and avoids rewriting session history. New sessions can be created via the web UI; rename and auto-title append a `session_info` metadata line, and entry labels append a `label` line, to the existing JSONL file.

2. **Live updates via SSE**: The browser opens an EventSource connection. The server watches session files via `fsnotify` (with polling fallback) and pushes `reload` events; session pages fetch `/api/session` to reconcile canonical JSONL entries. Browser chat can also receive best-effort `chat-preview` SSE events before JSONL reconciliation.

3. **Chat via RPC workers**: Each session gets a dedicated `pi --mode rpc` subprocess. Workers are cached and reaped after 10 minutes of idle time.

4. **Single Svelte SPA + static export**: All live browser routes (`/`, `/session`, `/settings`, `/schedules`) are Svelte 5 components built by Vite and served by one embedded shell (`internal/ui/embedded/app.html`). Sharing/export renders a separate self-contained snapshot (`internal/ui/export.go`). The pre-auth token prompt is the only other HTML page, rendered by the Go auth middleware.

5. **Security**: Token-based auth (`PI_WEB_TOKEN`) is required when binding to non-loopback addresses (e.g., Tailscale).
