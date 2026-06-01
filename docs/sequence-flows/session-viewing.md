# Sequence Flow: Viewing a Session

This flow covers a user clicking a session card on the index page (or visiting `/session?id=…` directly).

## Sequence Diagram

```
┌─────────┐   ┌─────────┐   ┌──────────────┐   ┌────────────────┐   ┌─────────────┐   ┌──────────┐
│ Browser │   │  Server │   │   sessions   │   │ renderLive    │   │  template   │   │  marked  │
│         │   │         │   │ (cache/parse) │   │ SessionPage   │   │   (embed)   │   │ highlight│
└────┬────┘   └────┬────┘   └──────┬───────┘   └───────┬────────┘   └──────┬──────┘   └────┬─────┘
     │             │               │                   │                  │              │
     │ GET /session?id=abc
     │────────────▶│               │                   │                  │              │
     │             │               │                   │                  │              │
     │             │─── cache.Resolve(sessionsDir, id) ▶│                  │              │
     │             │               │                   │                  │              │
     │             │               │─── ReadDir all project dirs          │              │
     │             │               │   find matching filename             │              │
     │             │               │                   │                  │              │
     │             │◀────────────── ResolvedSession ────│                  │              │
     │             │   (Session + Path)                  │                  │              │
     │             │               │                   │                  │              │
     │             │─── ParseFile(path, …) ─────────────▶│                  │              │
     │             │               │                   │                  │              │
     │             │               │─── scan JSONL lines                  │              │
     │             │               │─── json.Unmarshal each line            │              │
     │             │               │─── Count messages/tokens/cost          │              │
     │             │               │─── Check cwd exists                    │              │
     │             │               │                   │                  │              │
     │             │◀────────────── Session struct ─────│                  │              │
     │             │               │                   │                  │              │
     │             │─── renderLiveSessionPage(session) ──────────────────▶│              │
     │             │               │                   │                  │              │
     │             │               │                   ├─── base64(sessionData)
     │             │               │                   │                  │              │
     │             │               │                   ├─── template.html │              │
     │             │               │                   ├─── template.css  │              │
     │             │               │                   ├─── session Vite module path       │
     │             │               │                   └─── chat_composer.html              │
     │             │               │                   │                  │              │
     │             │◀────────────── HTML string ───────│                  │              │
     │             │               │                   │                  │              │
     │◀──────────── Response (text/html) ──────────────│                  │              │
     │             │               │                   │                  │              │
     │             │               │                   │                  │              │
     │ GET /events?id=abc
     │────────────▶│               │                   │                  │              │
     │             │─── addClient(abc)                 │                  │              │
     │             │               │                   │                  │              │
     │◀──────────── SSE stream ────────────────────────│                  │              │
     │             │               │                   │                  │              │
```

## Step-by-Step

### 1. Request Arrives

```
GET /session?id=2026-01-15T10-30-00.000Z_a1b2c3d4.jsonl
```

### 2. Session Resolution

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

### 3. Parse Session

`sessions.ParseFile` reads and transforms the JSONL file:

1. **Stream file** line-by-line with a scanner
2. **Unmarshal each JSONL line** into `map[string]any`
3. **Categorize**:
   - `type == "session"` → `sess.Header`
   - `type == "session_info"` → latest metadata such as renamed display title
   - `type == "message"` → increment `MessageCount`, sum `TokenTotal`/`CostTotal`
   - All lines → `sess.Entries`
4. **Set display name**: latest `session_info.name`, else header `session.name`, else first user message, else filename
5. **Set `LastActivity`** to latest timestamp (or file modtime as fallback)
6. **Check chat availability**: if `cwd` from header no longer exists, disable chat

### 4. Generate HTML

`renderLiveSessionPage` assembles the final page via string replacement:

```go
func renderLiveSessionPage(session sessions.Session) string {
    // 1. Build session data payload
    sessionData := map[string]any{
        "header":  session.Header,
        "entries": session.Entries,
        "leafId":  lastEntryID,
        // …
    }
    dataBase64 := base64.StdEncoding.EncodeToString(marshal(sessionData))

    // 2. Build CSS with theme variables injected
    css := strings.Replace(sessionCss, "{{THEME_VARS}}", precomputedThemeVars, 1)
    css = strings.Replace(css, "{{BODY_BG}}", bodyBg, 1)
    css = strings.Replace(css, "{{CONTAINER_BG}}", cardBg, 1)
    css = strings.Replace(css, "{{INFO_BG}}", infoBg, 1)

    // 3. Assemble HTML
    html := liveSessionHtml
    html = strings.ReplaceAll(html, "{{TITLE}}", template.HTMLEscapeString(session.Name))
    html = strings.Replace(html, "{{CSS}}", css, 1)
    html = strings.Replace(html, "{{SESSION_DATA}}", dataBase64, 1)

    html = strings.Replace(html, "{{SESSION_SCRIPT}}", viteSessionModuleScript, 1)
    html = strings.Replace(html, "{{CHAT_COMPOSER}}", chatComposerHtml, 1)

    return html
}
```

`{{TITLE}}` appears in both the browser `<title>` and visible session header, so all occurrences are replaced with the parsed session display name.

### 5. SSE Subscription

Immediately after page load, the browser connects to:

```
GET /events?id=2026-01-15T10-30-00.000Z_a1b2c3d4.jsonl
```

The server:
1. Creates an `sseClient` with buffered channel
2. Sends `:ok\n\n` (SSE comment to confirm connection)
3. Blocks reading from `client.ch` or `r.Context().Done()`

When the session file changes, the file watcher calls `broadcast(sessID, "reload")`. The browser fetches `/api/session`, updates the visible session header and browser `<title>` from the returned `name`, appends new canonical entries, upserts live-rendered entries, and clears any temporary chat preview.

## Rename Flow

The command menu's **Rename** action calls:

```
POST /api/rename-session?id=2026-01-15T10-30-00.000Z_a1b2c3d4.jsonl
Content-Type: application/json

{"name":"New Name"}
```

The server validates the name, resolves the session path, and appends a `session_info` JSONL line. Parsers use the latest `session_info.name` as `Session.Name`, so the rename survives reloads and appears on both detail and index pages after refresh/live reload. `/api/session` includes this computed `name`, allowing connected detail pages to update their header/title immediately on the next SSE reload without a manual browser refresh.

## Command Menu & Keyboard Shortcuts

The session detail page has a `⋯` menu button (top-right) and supports keyboard shortcuts:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `⌘K` / `Ctrl+K` | Search Sessions | Opens a palette that lists sessions from the same working directory (fetches `GET /api/sessions?project=<cwd>`). Type to filter by name, click or press Enter to navigate. |
| `⌘B` / `Ctrl+B` | Toggle Tree | Shows/hides the session tree sidebar (mobile: opens sidebar panel; desktop: uncollapses sidebar). |
| `Escape` | Close | Closes any open overlay (menu, palette, modal). |

The command menu (`⋯`) is organized into sections:

- **Session** — Search Sessions (`⌘K`), New Session
- *(divider)* — Rename, Share, Fork, Clone
- **Preferences** — Appearance, Notifications, Spinner, Cat Gatekeeper
- **Development** — Resume via Terminal, Tree (`⌘B`), Diff
- **Insights** — Model Usage
- **Resources** — Documentation, GitHub
- *(no title)* — Version, Settings

The **Search Sessions** palette reuses the same CSS and palette template as the home page's `⌘K` palette. It filters server-side by `?project=` (the current session's working directory), then applies client-side text filtering with a 100ms debounce.

## Caching Behavior

Single-session views (`/session`, `/api/session`) use `sessions.Cache.Resolve`, which caches parsed full sessions by file modtime. When the JSONL file changes, including after rename, the new modtime causes a re-parse.

`sessions.Cache.LoadAll` is also used by the index page (`/`) to avoid re-parsing summaries for the session list. It returns `SessionSummary` structs (lightweight, no full entry list) keyed by file modtime.
