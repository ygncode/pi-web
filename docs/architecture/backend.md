# Backend Architecture

## Package Layout

```
pi-web/
├── cmd/pi-web/
│   └── main.go                 # Tiny CLI entry point; passes build version to app.Main
├── web/
│   └── assets_embed.go         # Embeds Vite build output from web/dist
├── internal/
│   ├── agentdir/
│   │   └── agentdir.go         # Resolve ~/.pi/agent dir + the paths pi-web stores under it
│   ├── app/
│   │   ├── app.go              # CLI flags, dependency wiring, HTTP mux setup
│   │   ├── network.go          # Bind host / loopback helpers
│   │   ├── tailscale.go        # Tailscale Serve detection/configuration
│   │   ├── models_cache.go     # Process-wide coalesced cache for model list
│   │   ├── browser.go          # Open the default browser at startup
│   │   ├── sounds.go           # Seed default notification sounds into the agent dir
│   │   ├── update.go           # runInstall / runRestart for self-update
│   │   └── state_file_*.go     # pi-web-state.json + flock helpers
│   ├── frontend/
│   │   └── assets.go           # Vite manifest parsing + static asset handlers
│   ├── ui/
│   │   ├── spa_page.go         # Live SPA shell renderer (RenderAppShell)
│   │   ├── app_script.go       # SPA Vite module URL path + script tag
│   │   ├── session_page.go     # Session page data prep (bootstrap base64 + CSS)
│   │   ├── live_page.go        # Live document shell + theme/font providers
│   │   ├── export.go           # Static export renderer
│   │   ├── auth_page.go        # Auth/token entry page
│   │   ├── pwa.go              # PWA routes: manifest, sw.js, icons, css, cat.webm
│   │   └── embedded/     # Embedded HTML/CSS/assets (shells, styles, export/)
│   ├── auth/
│   │   └── auth.go             # Token-based HTTP middleware
│   ├── chat/
│   │   └── request.go          # Multipart chat request parser (text + images)
│   ├── files/
│   │   └── files.go            # Bounded read-only dir listing for @mention autocomplete
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
│   │   ├── prompt.go           # OneShotPrompt: spawn pi for a single prompt (auto-title)
│   │   └── oneshot.go          # One-shot RPC for model enumeration
│   ├── server/
│   │   ├── server.go           # Server type, deps, SSE registry, route registration, SQLite open
│   │   ├── handlers.go         # index, session, api/session(s), new, fork/clone, rename, locations, models, custom-themes
│   │   ├── chat.go             # Chat, set-model, set-thinking, worker-status, commands handlers
│   │   ├── new_session.go      # New-session creation logic
│   │   ├── git.go              # /api/git/info, /api/git/rename-branch handlers
│   │   ├── diff.go             # /api/git/diff, /api/diff/reviews handlers
│   │   ├── files.go            # /api/files handler + per-cwd file-walk cache
│   │   ├── settings.go         # Server-backed user settings (/api/settings) + SPA shell helpers
│   │   ├── btw.go              # btw scratch-chat registry: get/new + legacy migration (SQLite)
│   │   ├── auto_title.go       # Auto-title sessions via OneShotPrompt; guards against clobbering user names
│   │   ├── auto_title_heuristic.go # Heuristic fallback title from first user message
│   │   ├── metrics.go          # /metrics + /api/metrics + pprof registration (gopsutil sampler)
│   │   ├── scratchpad.go       # Per-project scratchpad get/save (SQLite)
│   │   ├── annotations.go      # Per-session review annotations: list/create/delete + SSE snapshot (SQLite)
│   │   ├── projects.go         # Project visibility prefs: list/toggle/register + index filtering (SQLite)
│   │   ├── sound.go            # /api/sounds + /sounds/ asset serving
│   │   ├── push.go             # PushManager: VAPID, subscribe/unsubscribe, NotifyDone, NotifyScheduleDone
│   │   ├── scheduler.go        # Cron tick loop + fireSchedule runner (creates a session, sends instructions)
│   │   ├── schedules_api.go    # /api/schedules + /api/schedule(/run|/runs) handlers
│   │   ├── update.go           # /api/version, check-update, update, restart handlers
│   │   ├── events.go           # SSE endpoint (/events)
│   │   ├── sse_format.go       # SSE event framing helper
│   │   ├── share.go            # Share handler adapter
│   │   ├── watcher.go          # fsnotify + polling file watcher
│   │   ├── status.go           # Running-status computation logic
│   │   ├── status_sweeper.go   # Periodic status revalidation
│   │   └── status_watcher.go   # fsnotify on session-status/ dir
│   ├── sessions/
│   │   ├── session.go          # Session/SessionSummary structs, ParseFile, LoadAll, CreateSessionFile, RenameSession, fork/clone
│   │   ├── title.go            # ReadTitleInputs: extract auto-title source text from a session
│   │   ├── cache.go            # Modtime-aware session cache
│   │   └── lookup.go           # Resolve session by ID
│   ├── schedules/
│   │   └── schedule.go         # Schedule/Run structs, SQLite store, cron next-fire (robfig/cron)
│   ├── share/
│   │   └── share.go            # GitHub Gist creation logic
│   └── workers/
│       └── manager.go          # ChatWorker lifecycle: create, cache, reap
```

> The embedded standalone export bundle lives at `internal/ui/embedded/export/`
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
    renderExportSession func(s sessions.Session, theme string) string
    renderAppShell      func(w io.Writer, bootstrap string) error
    models              func(ctx context.Context) (json.RawMessage, error)
    lastKnown     map[string]struct{} // sessions currently broadcast as running
    lastKnownMu   sync.Mutex
    push          *PushManager    // web-push subscriptions + done notifications
    db            *sql.DB         // SQLite (~/.pi/agent/pi-web.sqlite)
    updater       *updater.Checker // optional; nil disables /api/version etc.
    runInstall    func(ctx context.Context) error // optional self-update install
    runRestart    func() error                    // optional self-update restart
    updateMu      sync.Mutex      // serializes install/restart
    stopCh        chan struct{}
    stopOnce      sync.Once
    wg            sync.WaitGroup

    fileWalk     *fileWalkCache  // bounded dir-listing cache for @mention autocomplete
    fileWalkOnce sync.Once

    startedAt      time.Time      // process uptime for the metrics dashboard
    metricsSampler processSampler // swappable in tests
    metricsCPUMu   sync.Mutex
    metricsCPULast map[int]cpuMark // per-PID CPU baselines for delta %CPU

    titleMu        sync.Mutex             // auto-title bookkeeping (see auto_title.go)
    titleInFlight  map[string]bool
    titledName     map[string]string      // sessID -> title pi-web last set
    titledCount    map[string]int         // sessID -> user-msg count at last titling
    titleUserOwned map[string]bool        // sessID -> user named it; never auto-title
}
```

`Deps` (passed to `New`) supplies everything wired from `internal/app`: the
`RenderExportSession` and `RenderAppShell` renderers, `Models`, `Cache`, `Auth`,
`ChatSender`, plus the optional `Updater`, `RunInstall`, and `RunRestart`. When
`Updater` is nil the version/update routes are not registered; when
`RunInstall`/`RunRestart` are nil the corresponding endpoints respond `503`.

On `New`, the server opens (and migrates) a SQLite database at
`~/.pi/agent/pi-web.sqlite` with six tables: `scratchpads` (per project path),
`settings` (server-backed user settings key/value), `project_prefs` (which
projects are enabled), `app_settings` (the project-filter master switch, default
off), `btw_sessions` (the btw scratch-chat registry), and `annotations`
(per-session review notes keyed by session id; see `annotations.go`). See
`projects.go`, `settings.go`, and `btw.go`. The pool is capped to a single
connection (`SetMaxOpenConns(1)`) so concurrent writers queue instead of failing
with "database is locked". A `PushManager` (when configured) persists web-push
subscriptions and VAPID keys under the agent dir.

### `sessions.Session`

The domain model for a session file. The scalar fields live on `SessionSummary`
(reused for the index, where entries aren't parsed); `Session` embeds it and adds
the full header + entries.

```go
type SessionSummary struct {
    ID                 string
    SessionUUID        string
    Filename           string
    Project            string
    LastActivity       string
    Name               string
    MessageCount       int
    TokenTotal         int
    CostTotal          float64
    Model              string  // last-known model from messages or model_change
    ModelProvider      string  // provider for the last-known model
    ChatAvailable      bool
    ChatDisabledReason string
}

type Session struct {
    SessionSummary
    Header  map[string]any   // type=="session" line
    Entries []map[string]any // all JSONL lines
}
```

### `workers.Manager`

Manages `pi --mode rpc` subprocesses per session.

```go
type Manager struct {
    mu         sync.Mutex
    workers    map[string]ChatWorker  // sessionID → worker
    creating   map[string]*createCall // single-flight: coalesce concurrent creates per session
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
    startedAt            time.Time // process start; feeds metrics uptime
    cmd                  *exec.Cmd
    stdin                io.WriteCloser
    status               workers.WorkerStatus
    seq                  atomic.Uint64
    pending              map[string]chan response  // in-flight RPC calls
    currentModel         string
    currentProvider      string
    currentThinkingLevel string
    stderrBuf            *strings.Builder
    commands             []workers.SlashCommand // cached get_commands result
    commandsCached       bool
    lastActive           atomic.Int64 // unix nanos; user-initiated actions
    lastStreamActivity   atomic.Int64 // unix nanos; stream events keep worker visually running
    streamSink           StreamEventSink
    streamPreview        *streamPreviewAccumulator
}
```

## HTTP Handler Map

| Route | Method | Handler | Description |
|-------|--------|---------|-------------|
| `/` | GET | `handleIndex` | Render SPA shell for the sessions route |
| `/session` | GET | `handleSession` | Render SPA shell for the session route |
| `/settings` | GET | `handleSettingsPage` | Render SPA shell for the settings route |
| `/login` | GET | `handleAppShell` | Render SPA shell for the login route |
| `/api/session` | GET | `handleApiSession` | JSON session data |
| `/api/sessions` | GET | `handleApiSessions` | JSON list of session summaries |
| `/api/chat` | POST | `handleChat` | Send chat message (multipart) |
| `/api/chat/cancel` | POST | `handleCancelChat` | Abort running chat worker |
| `/api/set-model` | POST | `handleSetModel` | Change model for session |
| `/api/set-thinking-level` | POST | `handleSetThinkingLevel` | Change thinking level |
| `/api/models` | GET | `handleAvailableModels` | List available AI models |
| `/api/worker-status` | GET | `handleWorkerStatus` | Get worker state for session |
| `/api/commands` | GET | `handleCommands` | List slash commands exposed by the session worker |
| `/metrics` | GET | `handleMetricsPage` | Worker metrics dashboard (self-contained HTML) |
| `/api/metrics` | GET | `handleMetrics` | JSON snapshot: process + per-worker CPU/RSS (gopsutil); see `docs/dev/metrics-dashboard.md` |
| `/api/debug/pprof/` | GET | `pprof.Index` (+ cmdline/profile/symbol/trace) | Go runtime profiler, auth-gated (`/api`-stripped before Index) |
| `/share` | POST | `handleShare` | Create private GitHub Gist |
| `/events` | GET | `handleEvents` | SSE stream |
| `/api/new-session` | POST | `handleNewSession` | Create new session file |
| `/api/fork-session` | POST | `handleApiForkSession` | Fork a session into a new file |
| `/api/clone-session` | POST | `handleApiCloneSession` | Clone a session into a new file |
| `/api/rename-session` | POST | `handleRenameSession` | Append `session_info` rename metadata |
| `/api/label-session` | POST | `handleLabelSessionEntry` | Append a label to a session entry |
| `/api/recent-locations` | GET | `handleRecentLocations` | List known project paths |
| `/api/files` | GET | `handleApiFiles` | Bounded file listing for @mention autocomplete |
| `/api/git/info` | GET | `handleGitInfo` | Branch / dirty / PR-URL info for a project |
| `/api/git/rename-branch` | POST | `handleGitRenameBranch` | Rename the current git branch |
| `/api/git/diff` | GET | `handleGitDiff` | Uncommitted working-tree diff (tracked + untracked) for the session cwd |
| `/api/diff/reviews` | GET/POST/DELETE | `handleReviewComments` | Per-session diff review comments for the diff modal (SQLite) |
| `/api/scratchpad` | GET/POST | `handleGetScratchpad` / `handleSaveScratchpad` | Per-project scratchpad (SQLite) |
| `/api/annotations` | GET/POST/DELETE | `handleAnnotations` | Per-session review annotations; mutations broadcast an `annotations` SSE snapshot (SQLite) |
| `/api/settings` | GET/POST | `handleGetSettings` / `handleSaveSettings` | Server-backed user settings (SQLite) |
| `/api/btw` | GET | `handleGetBtw` | Resolve the btw scratch-chat session for a parent (SQLite) |
| `/api/btw/new` | POST | `handleNewBtw` | Create a new btw scratch-chat session (SQLite) |
| `/api/projects` | GET/POST | `handleApiProjects` / `handleUpdateProject` | List projects + filter state; enable/disable/register/remove, bulk enable-all/disable-all, enable-filter/disable-filter (SQLite) |
| `/api/sounds` | GET | `handleApiSounds` | List available notification sounds |
| `/sounds/` | GET | `handleSounds` | Serve a sound asset (no auth) |
| `/custom-themes.css` | GET | `handleCustomThemes` | User custom theme CSS |
| `/api/push/vapid` | GET | `handleVapid` | VAPID public key (when push enabled) |
| `/api/push/subscribe` | POST | `handleSubscribe` | Register a web-push subscription |
| `/api/push/unsubscribe` | POST | `handleUnsubscribe` | Remove a web-push subscription |
| `/api/schedules` | GET/POST | `handleApiSchedules` | List schedules (with `nextRunAt`) / create (SQLite) |
| `/api/schedule` | GET/POST/PUT/DELETE | `handleApiSchedule` | Read/update/delete one schedule (`?id=`) |
| `/api/schedule/run` | POST | `handleApiScheduleRun` | Fire a schedule now (`?id=`); returns created `sessionId` |
| `/api/schedule/runs` | GET | `handleApiScheduleRuns` | Run log for a schedule (`?id=`) |
| `/api/version` | GET | `handleVersion` | Current/latest version (when updater set) |
| `/api/check-update` | POST | `handleCheckUpdate` | Force a version check |
| `/api/update` | POST | `handleUpdate` | Install the latest pi-web |
| `/api/restart` | POST | `handleRestart` | Restart the service onto the new binary |

PWA / static asset routes (registered outside `Server.Register`):

| Route | Source |
|-------|--------|
| `/manifest.webmanifest`, `/sw.js`, `/icon.svg`, `/icon-maskable.svg`, `/pi-logo.svg`, `/cat.webm`, `/theme.css`, `/index.css`, `/menu.css`, `/palette.css` | `internal/ui/pwa.go` (embedded assets) |
| `/static/assets/app-*.js`, `/static/assets/...` | Embedded Vite SPA bundle and chunks (`internal/app/app.go` + `internal/frontend`) |

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
