# Backend Architecture

## Package Layout

```
pi-web/
├── main.go                     # CLI entry point, wiring, HTTP mux setup
├── network.go                  # Host detection (Tailscale, loopback)
├── models_cache.go             # Process-wide coalesced cache for model list
├── export.go                   # Session HTML export (embedded templates)
├── index_template.go           # Index page template + helpers
├── dist_embed.go               # Vite build embedding + manifest parsing
│
├── internal/
│   ├── auth/
│   │   └── auth.go             # Token-based HTTP middleware
│   ├── chat/
│   │   └── request.go          # Multipart chat request parser (text + images)
│   ├── render/
│   │   └── assets.go           # Vite manifest parsing helpers
│   ├── rpc/
│   │   ├── client.go           # JSONL RPC command builders
│   │   ├── worker.go           # pi --mode rpc subprocess worker
│   │   ├── stream.go           # SSE chat-preview stream accumulator
│   │   └── oneshot.go          # One-shot RPC for model enumeration
│   ├── server/
│   │   ├── server.go           # Server type, deps, SSE client registry
│   │   ├── handlers.go         # HTTP handlers (index, session, api, new, locations, models)
│   │   ├── chat.go             # Chat, set-model, set-thinking, worker-status handlers
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
    renderExportSession func(s sessions.Session) string
    models              func(ctx context.Context) (json.RawMessage, error)
    lastKnown     map[string]struct{} // sessions currently broadcast as running
    lastKnownMu   sync.Mutex
    stopCh        chan struct{}
    stopOnce      sync.Once
    wg            sync.WaitGroup
}
```

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
| `/session` | GET | `handleSession` | Render single session as embedded HTML |
| `/api/session` | GET | `handleApiSession` | JSON session data |
| `/api/chat` | POST | `handleChat` | Send chat message (multipart) |
| `/api/chat/cancel` | POST | `handleCancelChat` | Abort running chat worker |
| `/api/set-model` | POST | `handleSetModel` | Change model for session |
| `/api/set-thinking-level` | POST | `handleSetThinkingLevel` | Change thinking level |
| `/api/models` | GET | `handleAvailableModels` | List available AI models |
| `/api/worker-status` | GET | `handleWorkerStatus` | Get worker state for session |
| `/share` | POST | `handleShare` | Create private GitHub Gist |
| `/events` | GET | `handleEvents` | SSE stream |
| `/api/new-session` | POST | `handleNewSession` | Create new session file |
| `/api/rename-session` | POST | `handleRenameSession` | Append `session_info` rename metadata |
| `/api/recent-locations` | GET | `handleRecentLocations` | List known project paths |

| `/static/assets/index-*.js` | GET | — | Embedded Vite index bundle |

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
- Specific session ID — session page subscribes here; receives `reload` when the file changes

Broadcasting is fire-and-forget with a buffered channel (16). If the client is slow, keyless events are dropped rather than blocking. Duplicate `reload` and `new-session` events are coalesced per-client while pending.

## Running-Status Computation

Three signals are OR'd together to determine if a session is "running":

1. **session-status file** (`~/.pi/agent/session-status/<id>`): written by the terminal pi process
2. **In-process chat worker**: `chatSender.Status(id).State == running`
3. **Recent file activity**: modtime within 3 seconds

Status changes are broadcast as SSE `status-delta` events to `__all__` subscribers. A 1-second sweeper periodically revalidates all known running sessions to clean up stale states.
