# Sequence Flow: Viewing a Session

This flow covers a user clicking a session card on the index page (or visiting `/session?id=…` directly).

## Sequence Diagram

```txt
Browser ── GET /session?id=abc ──▶ Server
Server  ── render SPA shell ─────▶ Browser
Browser ── GET /api/session?id=abc ──▶ Server
Server  ── cache.Resolve + ParseFile ─▶ sessions
Server  ◀─ Session struct ─────────── sessions
Browser ◀─ JSON session payload ───── Server
Browser ── GET /events?id=abc ──────▶ Server (SSE)
```

## Step-by-Step

### 1. Browser Route Shell

`GET /session?id=...` is handled by `handleSession`, which serves the single SPA shell (`internal/ui/embedded/app.html`) through `ui.RenderAppShell`. The shell loads the hashed Vite/Svelte SPA entrypoint from `web/dist/.vite/manifest.json`.

### 2. Session Route Data Fetch

`web/src/routes/SessionPage.svelte` reads the `id` query parameter and fetches:

```txt
GET /api/session?id=<session-id>
```

The route then builds the session payload expected by the existing session rendering/runtime modules and mounts the session UI.

### 3. Session Resolution

`sessions.Cache.Resolve` validates and locates the file, then returns a cached parsed session when the file modtime is unchanged:

```go
func (c *Cache) Resolve(sessionsDir, id string) (ResolvedSession, error) {
    // Validate: must be a basename ending in .jsonl
    if id == "" || filepath.Base(id) != id || filepath.Ext(id) != ".jsonl" {
        return ResolvedSession{}, ErrInvalidSessionID
    }
    // Use the path index or walk all project subdirs to find the file.
    path, err := findPathByFilename(sessionsDir, id)
    // …
}
```

Security: `filepath.Base(id) != id` prevents path traversal.

### 4. Parse Session

`sessions.ParseFile` reads and transforms the JSONL file:

1. Stream file line-by-line with a scanner
2. Unmarshal each JSONL line into `map[string]any`
3. Categorize:
   - `type == "session"` → `sess.Header`
   - `type == "session_info"` → latest metadata such as renamed display title
   - `type == "message"` → increment `MessageCount`, sum `TokenTotal`/`CostTotal`
   - all lines → `sess.Entries`
4. Set display name: latest `session_info.name`, else header `session.name`, else first user message, else filename
5. Set `LastActivity` to latest timestamp (or file modtime as fallback)
6. Check chat availability: if `cwd` from header no longer exists, disable chat

### 5. API Response

`handleApiSession` returns JSON used by the Svelte route and live reload:

```json
{
  "header": { "cwd": "/path/to/project" },
  "entries": [],
  "name": "Session title",
  "total": 123,
  "from": 0,
  "chatAvailable": true,
  "chatDisabledReason": "",
  "model": "...",
  "modelProvider": "..."
}
```

For large sessions, `from`/`count` pagination can return an entry window. The Svelte route and `load-earlier` UI use this to prepend older entries.

### 6. SSE Subscription

After session UI initialization, the browser connects to:

```txt
GET /events?id=<session-id>
```

The server:

1. Creates an `sseClient` with buffered channel
2. Sends `:ok\n\n` (SSE comment to confirm connection)
3. Blocks reading from `client.ch` or `r.Context().Done()`

When the session file changes, the file watcher calls `broadcast(sessID, "reload")`. The browser fetches `/api/session`, updates the visible session header and browser `<title>` from the returned `name`, appends new canonical entries, upserts live-rendered entries, and clears any temporary chat preview.

## Rename Flow

The command menu's **Rename** action calls:

```txt
POST /api/rename-session?id=<session-id>
{ "name": "New title" }
```

The server appends a `session_info` line with the new name. This preserves the append-only rule for existing session files while allowing the cache/API/UI to surface the latest title.
