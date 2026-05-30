# Sequence Flow: Share to GitHub Gist

This flow covers a user clicking the **Share** button on a session page, which creates a private GitHub Gist containing a standalone HTML export of the session.

## Sequence Diagram

```
┌─────────┐   ┌─────────┐   ┌────────────┐   ┌─────────────┐   ┌──────────┐   ┌─────────┐
│ Browser │   │  Server │   │   share    │   │   render    │   │    gh    │   │  GitHub │
│         │   │         │   │  (package) │   │ (internal/ui/export.go) │   │   CLI    │   │   API   │
└────┬────┘   └────┬────┘   └─────┬──────┘   └──────┬──────┘   └────┬─────┘   └────┬────┘
     │             │              │                  │               │              │
     │ POST /share?id=abc
     │────────────▶│              │                  │               │              │
     │             │              │                  │               │              │
     │             │─── share.Handle(w, r, deps) ──▶│               │              │
     │             │              │                  │               │              │
     │             │              │─── FindGh()      │               │              │
     │             │              │   (check known paths, then $PATH)               │
     │             │              │                  │               │              │
     │             │              │─── gh auth status│               │              │
     │             │              │   (verify logged in)              │               │
     │             │              │                  │               │              │
     │             │              │─── deps.Resolve(id)│               │              │
     │             │              │   (find matching session)         │               │
     │             │              │                  │               │              │
     │             │              │─── renderExportSessionPage(session)
     │             │              │                  │               │              │
     │             │              │                  │─── live_templates/session.html │
     │             │              │                  │─── styles/session.css │
     │             │              │                  │─── exportJs     │              │
     │             │              │                  │─── marked.js    │              │
     │             │              │                  │─── highlight.js │              │
     │             │              │                  │               │              │
     │             │              │◀───────────────── HTML string (no buttons)        │
     │             │              │                  │               │              │
     │             │              │─── os.MkdirTemp("pi-share-*")                    │
     │             │              │─── os.WriteFile(temp/session.html)                │
     │             │              │                  │               │              │
     │             │              │─── gh gist create --public=false temp/session.html
     │             │              │                  │               │              │
     │             │              │                  │               │─────────────▶│
     │             │              │                  │               │              │
     │             │              │                  │               │◀─────────────│
     │             │              │                  │               │   Gist URL   │
     │             │              │                  │               │              │
     │             │              │◀───────────────────────────────── (stdout)       │
     │             │              │                  │               │              │
     │             │              │─── os.RemoveAll(tempDir)                         │
     │             │              │                  │               │              │
     │             │◀───────────── JSON response ────│               │              │
     │             │   {gistUrl, gistId, previewUrl} │               │              │
     │             │              │                  │               │              │
     │◀──────────── Response ────────────────────────│               │              │
     │             │              │                  │               │              │
```

## Step-by-Step

### 1. Request

```
POST /share?id=2026-01-15T10-30-00.000Z_a1b2c3d4.jsonl
```

### 2. GitHub CLI Discovery

`share.FindGh()` checks known installation paths first (fast path), then falls back to `exec.LookPath`:

```go
candidates := []string{
    "/opt/homebrew/bin/gh",
    "/usr/local/bin/gh",
    "/usr/bin/gh",
    "/bin/gh",
}
```

If not found → `400` error: `"GitHub CLI (gh) not installed."`

### 3. Auth Check

```go
runner.AuthStatus()  // gh auth status
```

If not logged in → `400` error: `"GitHub CLI not logged in. Run 'gh auth login' first."`

### 4. Find and Render Session

The handler resolves the session by ID and then calls:

```go
renderExportSessionPage(session)
```

The export renderer omits live-only chrome (no back link, no share button, no chat composer) — the exported HTML is meant to be a clean, self-contained document.

### 5. Create Temporary File

```go
tmpDir, _ := os.MkdirTemp(os.TempDir(), "pi-share-*")
tmpFile := filepath.Join(tmpDir, "session.html")
os.WriteFile(tmpFile, []byte(html), 0644)
defer os.RemoveAll(tmpDir)
```

The temp directory is cleaned up after the gist is created, regardless of success or failure.

### 6. Create Gist

```go
runner.CreateGist(tmpFile)  // gh gist create --public=false <path>
```

The gist is created as **private** (`--public=false`).

### 7. Response

```json
{
  "gistUrl": "https://gist.github.com/setkyar/abc123",
  "gistId": "abc123",
  "previewUrl": "https://pi.dev/session/#abc123"
}
```

The `previewUrl` is a convenience link that points to `pi.dev/session/#<gistId>`, which can render the gist content.

## Error Responses

| Scenario | Status | Message |
|----------|--------|---------|
| Missing `id` param | 400 | `missing id` |
| `gh` not installed | 400 | `GitHub CLI (gh) not installed. Install from https://cli.github.com/` |
| `gh` not logged in | 400 | `GitHub CLI not logged in. Run 'gh auth login' first.` |
| Session not found | 404 | `session not found` |
| Gist creation fails | 500 | `{"error": "failed to create gist", "stderr": "…"}` |

## Exported HTML Properties

The shared HTML is completely **self-contained**:

- All CSS is inline (no external stylesheets)
- All JS is inline (no external scripts)
- Session data is base64-encoded inline
- Markdown rendering via inline `marked.min.js`
- Syntax highlighting via inline `highlight.min.js`
- No server dependencies — it works if saved and opened locally
