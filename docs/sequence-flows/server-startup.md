# Sequence Flow: Server Startup

This document traces the execution from `go run .` to the first HTTP request.

## Sequence Diagram

```
┌──────┐   ┌────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐   ┌────────┐
│  OS  │   │  main  │   │  network │   │  server  │   │ workers │   │  auth  │
└──┬───┘   └───┬────┘   └────┬─────┘   └────┬─────┘   └────┬────┘   └───┬────┘
   │           │             │              │              │            │
   │  exec     │             │              │              │            │
   │──────────▶│             │              │              │            │
   │           │             │              │              │            │
   │           │─── flag.Parse() ──────────▶│              │            │
   │           │             │              │              │            │
   │           │─── os.Stat(sessionsDir) ──▶│              │            │
   │           │             │              │              │            │
   │           │─── chooseBindHost() ──────▶│              │            │
   │           │             │              │              │            │
   │           │◀─────────── host ──────────│              │            │
   │           │             │              │              │            │
   │           │─── os.Getenv(PI_WEB_TOKEN) │              │            │
   │           │             │              │              │            │
   │           │─── auth.New(token) ────────────────────────────────────▶│
   │           │             │              │              │            │
   │           │◀─────────── Middleware ────│              │            │
   │           │             │              │              │            │
   │           │─── server.New(deps) ──────▶│              │            │
   │           │             │              │              │            │
   │           │             │              ├─── go watchFiles() ───────▶│
   │           │             │              │              │            │
   │           │             │              ├─── go startSessionStatusWatcher()│
   │           │             │              │              │            │
   │           │             │              ├─── go runStatusSweeper() ─▶│
   │           │             │              │              │            │
   │           │◀────────── Server ─────────│              │            │
   │           │             │              │              │            │
   │           │─── srv.Register(mux) ─────▶│              │            │
   │           │             │              │              │            │
   │           │─── loadIndexScript() ─────▶│              │            │
   │           │             │              │              │            │
   │           │                                                          │
   │           │             │              │              │            │
   │           │─── mux.HandleFunc(/static/assets/…) ───────────────────▶│
   │           │             │              │              │            │
   │           │─── writeStateFile() ────────▶│              │            │
   │           │             │              │              │            │
   │           │─── warmModelsCache() ─────▶│              │            │
   │           │             │              │              │            │
   │           │─── openBrowser(url) ──────▶│              │            │
   │           │   (if -o flag)             │              │            │
   │           │             │              │              │            │
   │           │─── http.ListenAndServe() ─▶│              │            │
   │           │             │              │              │            │
   │           │◀──────────── Blocks ───────│              │            │
```

## Step-by-Step

### 1. CLI Flag Parsing

```go
port := flag.String("p", "31415", "port to listen on")
hostOverride := flag.String("host", "", "host/IP to bind; defaults to 127.0.0.1")
open := flag.Bool("o", false, "auto-open browser")
insecure := flag.Bool("insecure", false, "allow non-loopback bind without PI_WEB_TOKEN")
```

### 2. Agent & Sessions Directory

```go
agentDir := piAgentDir()  // respects PI_CODING_AGENT_DIR, falls back to ~/.pi/agent
sessionsDir := filepath.Join(agentDir, "sessions")
if _, err := os.Stat(sessionsDir); os.IsNotExist(err) {
    fmt.Fprintf(os.Stderr, "sessions directory not found: %s\n", sessionsDir)
    os.Exit(1)
}
```

`piAgentDir()` checks `PI_CODING_AGENT_DIR` first, then falls back to `~/.pi/agent`. Exits early if the sessions directory doesn't exist (the user hasn't run `pi` yet).

### 3. Host Selection

Priority:
1. `--host` flag (explicit override)
2. `127.0.0.1` (default)

If no `--host` override is supplied and Tailscale is running, startup also runs:

```bash
tailscale serve --bg --https=<port> http://127.0.0.1:<port>
```

This gives the user a Tailscale HTTPS endpoint without making pi-web bind to a Tailscale interface or manage TLS certificates itself.

### 4. Auth Enforcement

```go
if token == "" && !isLoopbackHost(bindHost) && !*insecure {
    fmt.Fprintf(os.Stderr, "refusing to bind %s without PI_WEB_TOKEN set…\n")
    os.Exit(1)
}
```

Non-loopback binds **require** `PI_WEB_TOKEN` to prevent unauthorized access over the network.

### 5. Server Construction

```go
srv := server.New(server.Deps{
    AgentDir:      agentDir,
    SessionsDir:   sessionsDir,
    Auth:          authMiddleware,
    ChatSender:    workers.NewManager(func(sessionID, sessionPath string) (workers.ChatWorker, error) {
        return rpc.NewPiWorkerWithStream(sessionPath, func(preview rpc.StreamPreview) {
            if srv != nil {
                srv.BroadcastChatPreview(sessionID, preview)
            }
        })
    }),
    Cache:         sessions.NewCache(),
    RenderIndex:         func(w io.Writer, ss []sessions.SessionSummary) error { … },
    RenderLiveSession:   renderLiveSessionPage,
    RenderExportSession: renderExportSessionPage,
    Models:              func(ctx context.Context) (json.RawMessage, error) { … },
})
```

Server creation immediately spawns three background goroutines:

1. **`watchFiles()`** — watches `sessionsDir` for changes (fsnotify + polling fallback)
2. **`startSessionStatusWatcher()`** — watches `session-status/` for terminal activity
3. **`runStatusSweeper()`** — revalidates running status every second

### 6. Route Registration

All routes are wrapped with `auth.Wrap`:

```go
mux.HandleFunc("/", s.auth.Wrap(s.handleIndex))
mux.HandleFunc("/session", s.auth.Wrap(s.handleSession))
mux.HandleFunc("/api/chat", s.auth.Wrap(s.handleChat))
// … etc
```

### 7. Static Asset Loading

```go
if scriptPath, js, err := loadIndexScript(distFS()); err == nil {
    indexScriptPath = scriptPath
    mux.HandleFunc(scriptPath, serveIndexJS(js, true))
}
```

Reads Vite manifest to discover the hashed filename of the index bundle.

### 8. State File

```go
writeStateFile(agentDir, bindHost, port, tailscaleServe, tailscaleURL)
// → ~/.pi/agent/pi-web/pi-web-state.json
```

Contains PID, port, host, Tailscale Serve flag/URL, and start time. Cleaned up on shutdown. On first run, migrates from the old `~/.pi/agent/pi-web-state.json` location.

### 9. Model Cache Warming

```go
warmModelsCache() // async goroutine
```

Spawns `pi --mode rpc` once to fetch the model list, so the first session page load doesn't wait.

### 10. Listen

```go
httpServer := &http.Server{
    Addr:              addr,
    Handler:           mux,
    ReadHeaderTimeout: 10 * time.Second,
    IdleTimeout:       120 * time.Second,
}
httpServer.ListenAndServe()
```

Blocks until interrupted. On `SIGINT`/`SIGTERM` the server performs a graceful shutdown (5s timeout) and calls `srv.Shutdown()` to stop background goroutines.
