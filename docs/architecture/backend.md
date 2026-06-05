# Backend Architecture

## Package Layout

```
pi-web/
├── cmd/pi-web/
│   └── main.go                 # Tiny CLI entry point; passes build version to app.Main
├── web/
│   └── assets_embed.go         # Embeds Vite build output from web/dist
├── internal/
│   ├── app/
│   │   ├── app.go              # CLI flags, dependency wiring, HTTP mux setup
│   │   ├── network.go          # Bind host / loopback helpers
│   │   ├── tailscale.go        # Tailscale Serve detection/configuration
│   │   ├── models_cache.go     # Process-wide coalesced cache for model list
│   │   ├── update.go           # runInstall / runRestart for self-update
│   │   └── state_file_*.go     # pi-web-state.json + flock helpers
│   ├── frontend/
│   │   └── assets.go           # Vite manifest parsing + static asset handlers
│   ├── ui/
│   │   ├── session_page.go     # Live session renderer
│   │   ├── export.go           # Static export renderer
│   │   ├── index_template.go   # Index page template + helpers
│   │   ├── live_page.go        # Live page shell rendering helpers
│   │   ├── live_menu.go        # Command/theme menu rendering
│   │   ├── palette.go          # Session-list palette rendering
│   │   ├── auth_page.go        # Auth/token entry page
│   │   ├── pwa.go              # PWA routes: manifest, sw.js, icons, css, cat.webm
│   │   └── live_templates/     # Embedded HTML/CSS/assets (shells, styles, export/)
│   ├── auth/
│   │   └── auth.go             # Token-based HTTP middleware
│   ├── chat/
│   │   └── request.go          # Multipart chat request parser (text + images)
│   ├── render/
│   │   ├── assets.go           # Vite manifest parsing helpers
│   │   └── json.go             # WriteJSON / WriteJSONError helpers
│   ├── git/
│   │   └── git.go              # git branch info, rename, PR URL detection
│   ├── updater/
│   │   └── updater.go          # Background version checker + changelog fetch
│   ├── rpc/
│   │   ├── client.go           # JSONL RPC command builders
│   │   ├── worker.go           # pi --mode rpc subprocess worker
│   │   ├── stream.go           # SSE chat-preview stream accumulator
│   │   └── oneshot.go          # One-shot RPC for model enumeration
│   ├── server/
│   │   ├── server.go           # Server type, deps, SSE registry, SQLite open
│   │   ├── handlers.go         # index, session, api/session(s), new, fork/clone, rename, locations, models, custom-themes
│   │   ├── chat.go             # Chat, set-model, set-thinking, worker-status handlers
│   │   ├── new_session.go      # New-session creation logic
│   │   ├── git.go              # /api/git/info, /api/git/rename-branch handlers
│   │   ├── scratchpad.go       # Per-project scratchpad get/save (SQLite)
│   │   ├── annotations.go      # Per-session review annotations: list/create/delete + SSE snapshot (SQLite)
│   │   ├── projects.go         # Project visibility prefs: list/toggle/register + index filtering (SQLite)
│   │   ├── sound.go            # /api/sounds + /sounds/ asset serving
│   │   ├── push.go             # PushManager: VAPID, subscribe/unsubscribe, NotifyDone
│   │   ├── update.go           # /api/version, check-update, update, restart handlers
│   │   ├── events.go           # SSE endpoint (/events)
│   │   ├── share.go            # Share handler adapter
│   │   ├── watcher.go          # fsnotify + polling file watcher
│   │   ├── status.go           # Running-status computation logic
│   │   ├── status_sweeper.go   # Periodic status revalidation
│   │   └── status_watcher.go   # fsnotify on session-status/ dir
│   ├── sessions/
│   │   ├── session.go          # Session struct, ParseFile, LoadAll, CreateSessionFile, RenameSession
│   │   ├── cache.go            # Modtime-aware session cache
│   │   └── lookup.go           # Resolve session by ID
│   ├── share/
│   │   └── share.go            # GitHub Gist creation logic
│   └── workers/
│       └── manager.go          # ChatWorker lifecycle: create, cache, reap
```

> The embedded standalone export bundle lives at `internal/ui/live_templates/export/`
> (`app/*.js` + `vendor/`), **not** at `internal/ui/export/`.

## Key Types

### `server.Server`

Central state holder. Created once at startup, lives for the process lifetime.

```go
type Server struct {
    agentDir      string          // ~/.pi/agent (respects PI_CODING_AGENT_DIR)
    sessionsDir   string          // ~/.pi/agent/sessions
    clients       []*sseClient    // active SSE connections
    clientsMu     sync.RWMutex
    fileMod       map[string]time.Time  // last seen modtime per session
    fileModMu     sync.RWMutex
    chatSender    ChatSender      // workers.Manager
    cache         *sessions.Cache // modtime-aware parse cache
    auth          *auth.Middleware
    shareRunner   shareCmdRunner  // overridable in tests
    now           func() time.Time
    renderIndex         func(w io.Writer, summaries []sessions.SessionSummary) error
    renderLiveSession   func(s sessions.Session) string
    renderExportSession func(s sessions.Session, theme string) string
    models              func(ctx context.Context) (json.RawMessage, error)
    lastKnown     map[string]struct{} // sessions currently broadcast as running
    lastKnownMu   sync.Mutex
    push          *PushManager    // web-push subscriptions + done notifications
    db            *sql.DB         // SQLite (~/.pi/agent/pi-web.sqlite) for scratchpads
    updater       *updater.Checker // optional; nil disables /api/version etc.
    runInstall    func(ctx context.Context) error // optional self-update install
    runRestart    func() error                    // optional self-update restart
    updateMu      sync.Mutex      // serializes install/restart
    stopCh        chan struct{}
    stopOnce      sync.Once
    wg            sync.WaitGroup
}
```

`Deps` (passed to `New`) supplies everything wired from `internal/app`: renderers,
`Models`, `Cache`, `Auth`, `ChatSender`, plus the optional `Updater`, `RunInstall`,
and `RunRestart`. When `Updater` is nil the version/update routes are not registered;
when `RunInstall`/`RunRestart` are nil the corresponding endpoints respond `503`.

On `New`, the server opens (and migrates) a SQLite database at
`~/.pi/agent/pi-web.sqlite` — a `scratchpads` table keyed by project path, a
`project_prefs` table recording which projects are enabled, an `app_settings`
key/value table holding the project-filter master switch (default off), and an
`annotations` table holding per-session review notes (keyed by session id; see
`annotations.go`). See `projects.go`. The pool is capped to a single connection
(`SetMaxOpenConns(1)`) so concurrent writers queue instead of failing with
"database is locked". A `PushManager` (when configured) persists web-push
subscriptions and VAPID keys under the agent dir.

### `sessions.Session`

The domain model for a session file.

```go
type Session struct {
    ID                 string
    Filename           string
    SessionUUID        string
    Project            string
    LastActivity       string
    Name               string
    MessageCount       int
    TokenTotal         int
    CostTotal          float64
    Model              string                // last-known model from messages or model_change
    ModelProvider      string                // provider for the last-known model
    Header             map[string]any        // type=="session" line
    Entries            []map[string]any      // all JSONL lines
    ChatAvailable      bool
    ChatDisabledReason string
}
```

### `workers.Manager`

Manages `pi --mode rpc` subprocesses per session.

```go
type Manager struct {
    mu         sync.Mutex
    workers    map[string]ChatWorker  // sessionID → worker
    factory    Factory                // (sessionID, sessionPath) → ChatWorker
    idleTTL    time.Duration          // default 10m
    reaperStop chan struct{}
    reaperDone chan struct{}
}
```

`Manager.Snapshot()` returns one `WorkerSnapshot` per live worker (session ID,
state, model, plus PID/uptime/idle for workers implementing the optional
`inspector` interface). The metrics dashboard consumes it — see
`docs/dev/metrics-dashboard.md`.

### `rpc.piRPCWorker`

A single `pi --mode rpc` subprocess. Communicates via JSONL on stdin/stdout.

```go
type piRPCWorker struct {
    mu                   sync.Mutex
    writeMu              sync.Mutex
    sessionPath          string
    cmd                  *exec.Cmd
    stdin                io.WriteCloser
    status               workers.WorkerStatus
    seq                  atomic.Uint64
    pending              map[string]chan response  // in-flight RPC calls
    currentModel         string
    currentProvider      string
    currentThinkingLevel string
    stderrBuf            *strings.Builder
    lastActive           atomic.Int64 // unix nanos; user-initiated actions
    lastStreamActivity   atomic.Int64 // unix nanos; stream events keep worker visually running
    streamSink           StreamEventSink
    streamPreview        *streamPreviewAccumulator
}
```

## HTTP Handler Map

| Route | Method | Handler | Description |
|-------|--------|---------|-------------|
| `/` | GET | `handleIndex` | Render session list (Vite index bundle shell) |
| `/session` | GET | `handleSession` | Render single session page (Vite session bundle shell) |
| `/api/session` | GET | `handleApiSession` | JSON session data |
| `/api/sessions` | GET | `handleApiSessions` | JSON list of session summaries |
| `/api/chat` | POST | `handleChat` | Send chat message (multipart) |
| `/api/chat/cancel` | POST | `handleCancelChat` | Abort running chat worker |
| `/api/set-model` | POST | `handleSetModel` | Change model for session |
| `/api/set-thinking-level` | POST | `handleSetThinkingLevel` | Change thinking level |
| `/api/models` | GET | `handleAvailableModels` | List available AI models |
| `/api/worker-status` | GET | `handleWorkerStatus` | Get worker state for session |
| `/metrics` | GET | `handleMetricsPage` | Worker metrics dashboard (self-contained HTML) |
| `/api/metrics` | GET | `handleMetrics` | JSON snapshot: process + per-worker CPU/RSS (gopsutil); see `docs/dev/metrics-dashboard.md` |
| `/api/debug/pprof/` | GET | `pprof.Index` (+ cmdline/profile/symbol/trace) | Go runtime profiler, auth-gated (`/api`-stripped before Index) |
| `/share` | POST | `handleShare` | Create private GitHub Gist |
| `/events` | GET | `handleEvents` | SSE stream |
| `/api/new-session` | POST | `handleNewSession` | Create new session file |
| `/api/fork-session` | POST | `handleApiForkSession` | Fork a session into a new file |
| `/api/clone-session` | POST | `handleApiCloneSession` | Clone a session into a new file |
| `/api/rename-session` | POST | `handleRenameSession` | Append `session_info` rename metadata |
| `/api/recent-locations` | GET | `handleRecentLocations` | List known project paths |
| `/api/git/info` | GET | `handleGitInfo` | Branch / dirty / PR-URL info for a project |
| `/api/git/rename-branch` | POST | `handleGitRenameBranch` | Rename the current git branch |
| `/api/scratchpad` | GET/POST | `handleGetScratchpad` / `handleSaveScratchpad` | Per-project scratchpad (SQLite) |
| `/api/annotations` | GET/POST/DELETE | `handleAnnotations` | Per-session review annotations; mutations broadcast an `annotations` SSE snapshot (SQLite) |
| `/api/projects` | GET/POST | `handleApiProjects` / `handleUpdateProject` | List projects + filter state; enable/disable/register/remove, bulk enable-all/disable-all, enable-filter/disable-filter (SQLite) |
| `/api/sounds` | GET | `handleApiSounds` | List available notification sounds |
| `/sounds/` | GET | `handleSounds` | Serve a sound asset (no auth) |
| `/custom-themes.css` | GET | `handleCustomThemes` | User custom theme CSS |
| `/api/push/vapid` | GET | `handleVapid` | VAPID public key (when push enabled) |
| `/api/push/subscribe` | POST | `handleSubscribe` | Register a web-push subscription |
| `/api/push/unsubscribe` | POST | `handleUnsubscribe` | Remove a web-push subscription |
| `/api/version` | GET | `handleVersion` | Current/latest version (when updater set) |
| `/api/check-update` | POST | `handleCheckUpdate` | Force a version check |
| `/api/update` | POST | `handleUpdate` | Install the latest pi-web |
| `/api/restart` | POST | `handleRestart` | Restart the service onto the new binary |

PWA / static asset routes (registered outside `Server.Register`):

| Route | Source |
|-------|--------|
| `/manifest.webmanifest`, `/sw.js`, `/icon.svg`, `/icon-maskable.svg`, `/pi-logo.svg`, `/cat.webm`, `/theme.css`, `/index.css`, `/menu.css`, `/palette.css` | `internal/ui/pwa.go` (embedded assets) |
| `/static/assets/index-*.js`, `/static/assets/...` | Embedded Vite bundles (`internal/app/app.go` + `internal/frontend`) |

## Auth Flow

```
Request ──▶ auth.Wrap(handler)
                │
                ▼
        token set in env?
                │
        ┌───────┴───────┐
        ▼               ▼
      yes              no
        │               │
        ▼               ▼
   extract token    pass through
   (query → Authorization: Bearer → X-Pi-Token → cookie)
        │
        ▼
   constant-time compare
        │
   ┌────┴────┐
   ▼         ▼
 match    mismatch
   │         │
   ▼         ▼
 handler   401 Unauthorized
```

## SSE Broadcasting

The server maintains a slice of `sseClient` structs. Each client subscribes to a `sessID`:

- `__all__` — index page subscribes here; receives `new-session`, `status-snapshot`, `status-delta`
- Specific session ID — session page subscribes here; receives `reload` when the file changes, `chat-preview` during streaming, and `annotations` (a full annotation snapshot) whenever a note is created/deleted for that session

Broadcasting is fire-and-forget with a buffered channel (16). If the client is slow, keyless events are dropped rather than blocking. Duplicate `reload` and `new-session` events are coalesced per-client while pending.

## Running-Status Computation

Three signals are OR'd together to determine if a session is "running":

1. **session-status file** (`~/.pi/agent/session-status/<id>`): written by the terminal pi process
2. **In-process chat worker**: `chatSender.Status(id).State == running`
3. **Recent file activity**: modtime within 3 seconds

Status changes are broadcast as SSE `status-delta` events to `__all__` subscribers. A 1-second sweeper periodically revalidates all known running sessions to clean up stale states.
