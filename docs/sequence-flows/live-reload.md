# Sequence Flow: Live Reload

pi-web pushes real-time updates to the browser via **Server-Sent Events (SSE)**. This document covers both the file-watching → SSE path and the status-tracking → SSE path.

## Overview

There are two independent live-update mechanisms:

1. **File Change Reload** — when a session JSONL file is modified, the session page fetches `/api/session`, reconciles canonical entries, and refreshes the visible/browser session title from the returned `name`
2. **Running Status Updates** — when a session starts/stops running, the index page updates card badges in real-time

## 1. File Change Reload

### Sequence Diagram

```
┌─────────┐   ┌──────────┐   ┌─────────────┐   ┌────────────┐   ┌─────────┐
│ Editor  │   │  fsnotify │   │  debouncer  │   │   Server   │   │ Browser │
│         │   │  watcher  │   │             │   │            │   │         │
└────┬────┘   └────┬─────┘   └──────┬──────┘   └─────┬──────┘   └────┬────┘
     │             │                │                │               │
     │ saves file  │                │                │               │
     │────────────▶│                │                │               │
     │             │                │                │               │
     │             │ Write event    │                │               │
     │             │────────────────▶                │               │
     │             │                │                │               │
     │             │                │ schedule(path) │               │
     │             │                │─── 50ms timer ─▶                │
     │             │                │                │               │
     │ [more saves]│                │                │               │
     │────────────▶│ Write event    │                │               │
     │             │────────────────▶                │               │
     │             │                │ reset timer    │               │
     │             │                │                │               │
     │             │                │─── timer fires ─▶               │
     │             │                │                │               │
     │             │                │                │ recordModTime │
     │             │                │                │               │
     │             │                │                │─── update fileMod map
     │             │                │                │─── broadcast(sessID, "reload")
     │             │                │                │               │
     │             │                │                │─── recomputeAndBroadcastStatus
     │             │                │                │               │
     │             │                │                │               │
     │             │                │                │   SSE: reload │
     │             │                │                │───────────────▶
     │             │                │                │               │
     │             │                │                │               │─── fetch /api/session
     │             │                │                │               │─── update document/header title from data.name
     │             │                │                │               │─── append/upsert canonical entries
     │             │                │                │               │
```

### fsnotify Path

At startup, `watchFilesFsnotify()`:

1. Creates an `fsnotify.Watcher`
2. Watches `sessionsDir`
3. Watches each existing project subdir
4. Spawns a goroutine to consume events

On `Create` events:
- If it's a new directory → add to watcher
- If it's a `.jsonl` file → broadcast `new-session` to `__all__`

On `Write` events for `.jsonl` files:
- Schedule debounce (50ms)

### Debouncer

```go
type debouncer struct {
    delay  time.Duration   // 50ms
    timers map[string]*time.Timer
}

func (d *debouncer) schedule(path string) {
    // Reset existing timer or create new one
    // After delay: send path to wakeCh
}
```

The debouncer prevents multiple reloads when editors write files in chunks (e.g., atomic saves).

### Polling Fallback

If `fsnotify` fails to initialize (e.g., on NFS or some container environments), the server falls back to polling:

```go
func (s *Server) watchFilesPolling() {
    ticker := time.NewTicker(1500 * time.Millisecond)
    for range ticker.C {
        s.scanForChanges()
    }
}
```

Polling scans all `.jsonl` files and compares modtimes against `fileMod` map.

## 2. Running Status Updates

### Sequence Diagram

```
┌─────────────┐   ┌────────────────┐   ┌──────────────┐   ┌─────────┐   ┌─────────┐
│ Terminal pi │   │ session-status │   │ status watcher│   │ Server  │   │ Browser │
│  (writing)  │   │    directory   │   │  (fsnotify)   │   │         │   │ (index) │
└──────┬──────┘   └───────┬────────┘   └───────┬───────┘   └────┬────┘   └────┬────┘
       │                  │                    │                │             │
       │ writes status    │                    │                │             │
       │─────────────────▶│                    │                │             │
       │                  │                    │                │             │
       │                  │ Create/Write/Rename event │                │             │
       │                  │───────────────────▶│                │             │
       │                  │                    │                │             │
       │                  │                    │─── recomputeAndBroadcastStatus
       │                  │                    │                │             │
       │                  │                    │                │ computeRunningStatus
       │                  │                    │                │             │
       │                  │                    │                │─── readSessionStatus
       │                  │                    │                │─── chatSender.Status
       │                  │                    │                │─── hasRecentSessionActivity
       │                  │                    │                │             │
       │                  │                    │                │─── if changed:
       │                  │                    │                │     update lastKnown
       │                  │                    │                │     broadcast to __all__
       │                  │                    │                │             │
       │                  │                    │                │   SSE: status-delta
       │                  │                    │                │─────────────▶
       │                  │                    │                │             │
       │                  │                    │                │             │─── applyDelta()
       │                  │                    │                │             │─── toggle CSS class
       │                  │                    │                │             │
```

### Three Signals for "Running"

`computeRunningStatus(sessionID)` returns true if **any** of these are true:

1. **session-status file** exists and has `state: "running"` and `updatedAt` within 10s TTL
2. **Chat worker** status is `running` (in-process)
3. **Recent file activity**: JSONL file modtime within 3 seconds

### Status Sweeper

A background ticker runs every second:

```go
func (s *Server) runStatusSweeper(stop <-chan struct{}, interval time.Duration) {
    for {
        select {
        case <-ticker:
            s.sweepStatusOnce()  // recompute all known running sessions
        case <-stop:
            return
        }
    }
}
```

This catches cases where a signal goes stale (e.g., terminal process crashes without cleaning up its status file).

### SSE Event Types

| Event | Topic | Payload | Trigger |
|-------|-------|---------|---------|
| `reload` | `sessID` | `"reload"` | Session file modified |
| `new-session` | `__all__` | `"new-session"` | New `.jsonl` file created |
| `status-snapshot` | `__all__` | `{"running": ["id1", "id2"]}` | Client connects to `/events?id=__all__` |
| `status-delta` | `__all__` | `{"id": "abc", "running": true}` | Running status changes |
| `chat-preview` | `sessID` | `{"content": "...", "done": false}` | Best-effort browser chat preview |

### Browser Handling

**Index page** (`/events?id=__all__`):
```js
es.addEventListener('status-snapshot', (e) => this.applySnapshot(e.data))
es.addEventListener('status-delta', (e) => this.applyDelta(e.data))
es.onmessage = (e) => { if (e.data === 'new-session') window.location.reload() }
```

**Session page** (`/events?id=<sessID>`):
```js
es.onmessage = (e) => {
  if (e.data !== 'reload') return
  fetch('/api/session?id=' + encodeURIComponent(sessId))
    .then((r) => r.json())
    .then((data) => {
      if (data.name) updateTitle(data.name)
      clearChatPreview()
      // append/upsert canonical entries
    })
}
es.addEventListener('chat-preview', (e) => renderChatPreview(JSON.parse(e.data)))
```

---

**E2E coverage:** `e2e/tests/live-reload.spec.ts` appends to a session file on disk and asserts the change surfaces in the browser via SSE. See [docs/dev/e2e-testing.md](../dev/e2e-testing.md).
