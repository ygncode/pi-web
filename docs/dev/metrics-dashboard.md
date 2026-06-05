# Worker Metrics Dashboard

A lightweight, self-contained dashboard for inspecting running `pi --mode rpc`
workers and overall process health — useful when the app feels slow or you
suspect a worker is leaking or stuck.

It is intentionally **decoupled** from the session UI: a single JSON endpoint
plus a standalone HTML page. Nothing here touches session rendering, chat, SSE,
or export.

## Routes

| Route | What |
|---|---|
| `GET /metrics` | The dashboard HTML page (polls the JSON every 2s) |
| `GET /api/metrics` | JSON snapshot of process + per-worker resource usage |

Both are behind the normal `auth` middleware, so they inherit `PI_WEB_TOKEN`
when set. The page's `fetch('/api/metrics')` authenticates automatically via the
auth cookie.

## What it shows

**Process block** (app-slow diagnosis):

- `pid`, `uptime_s`
- `goroutines`, `heap_alloc_bytes` (from the Go runtime)
- `sse_clients` — currently connected SSE clients
- `watched_files` — session files tracked by the watcher

**Per-worker block** (resource hogs + leak/zombie detection):

- `session_id`, `pid`, `state` (idle / running / error), `model`
- `uptime_s`, `idle_for_s`
- `rss_bytes`, `cpu_time_s` (cumulative), `cpu_percent`
- `sampled` — false if the OS sample failed for that PID (e.g. the process exited
  mid-request); the worker still appears, just without CPU/RSS
- `zombie` — true when an **idle** worker has been idle longer than
  `workers.DefaultIdleTTL` (10 min) yet is still alive. Running workers are never
  flagged.

## How CPU% is computed

`gopsutil` only reports **cumulative** CPU seconds per process. To avoid a
blocking sample (`Percent(interval)` sleeps), the handler keeps a small per-PID
baseline and derives `cpu_percent` from the delta between successive
`/api/metrics` requests:

```
cpu_percent = (cpu_time_now - cpu_time_prev) / (wall_now - wall_prev) * 100
```

The first request for a PID has no baseline and reports `0`. Baselines for PIDs
that disappear are pruned each request, so the cache can't grow unbounded. A
negative delta (PID reuse) is clamped to `0`.

## Resource cost

Negligible. Per-PID `MemoryInfo()` / `Times()` are cheap syscalls; sampling a
handful of workers every couple of seconds is nothing, and the endpoint never
blocks. `gopsutil` adds only small, pure-Go (no cgo) deps on macOS/Linux.

## Going deeper with pprof (optional)

For "why is the whole app slow" investigations, Go's profiler gives a far more
detailed picture than the dashboard (which functions burn CPU, what holds
memory, where goroutines are stuck). If `net/http/pprof` is mounted (e.g. under
`/api/debug/pprof/`), point the Go tool at it:

```bash
go tool pprof http://localhost:31415/api/debug/pprof/heap
go tool pprof http://localhost:31415/api/debug/pprof/profile   # 30s CPU profile
```

The dashboard answers "*which worker* is heavy"; pprof answers "*which code* is
heavy."

## Implementation notes

- `internal/server/metrics.go` — handler, `processSampler` interface, gopsutil
  sampler, CPU-delta cache.
- `internal/server/metrics_dashboard.html` — the self-contained page (embedded
  via `//go:embed`).
- `internal/workers/manager.go` — `Manager.Snapshot()` returns one
  `WorkerSnapshot` per live worker. PID/uptime/idle come from an optional
  `inspector` interface implemented by the real rpc worker
  (`internal/rpc/worker.go`); test fakes that don't implement it report zeros.
- The sampler is swappable for tests via `Server.SetMetricsSampler`.
