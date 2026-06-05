# Sequence Flow: @mention Path Autocomplete

Typing `@` in the chat composer opens a popup of files and folders from the
session's working directory (`cwd`). It mirrors the slash-command palette but is
anchored to any `@` at a token boundary (not just position 0), and its entries
come from the filesystem rather than from pi's loaded commands.

This is a **live-only** feature: it needs the running server and the session's
real `cwd`. It is never part of the export/Gist snapshot (which has no composer).

## Components

Frontend (`web/src/session/chat/`):

- `mention-autocomplete.js` — `parseAtTrigger(text, caret)` (pure trigger
  detection), and `setupMentionAutocomplete(...)`: debounced fetch, render,
  keyboard nav, and path insertion.
- `chat-api.js` — `getFiles(sessionId, query, { signal })` → `GET /api/files`.
- `chat-composer-runner.js` — wires the controller in (`loadMentionSelector`)
  and gives it first dibs on navigation keys, after the slash palette.

Backend:

- `internal/server/files.go` — `GET /api/files?id=<sid>&q=<query>` handler plus a
  short-TTL per-`cwd` walk cache.
- `internal/files/` — `Walk` (bounded filesystem listing) + `Rank` (pure scoring).

The composer template (`internal/ui/live_templates/chat_composer.html`) holds the
`#pi-chat-mention-popup` / `#pi-chat-mention-list` elements; the popup reuses the
slash palette's `.pi-chat-slash-popup` / `.slash-item` styling.

## Trigger model

`parseAtTrigger` scans backward from the caret to the nearest `@` that is either
at the start of the message or preceded by whitespace, with no whitespace between
that `@` and the caret. It returns `{ query, start, end }` (the span to replace),
or `null` to close. An `@` preceded by a non-space (e.g. an email `foo@bar`) does
**not** trigger.

The query may carry a directory scope: `src/foo` → only entries under `src/`,
matched on basename `foo`; a bare `foo` → searched across `cwd`.

## Two listing strategies (cheap by default)

The trailing **term** length (the part after the last `/`) selects the strategy,
so the expensive recursive scan only runs once the user is actually searching —
important on small hardware (e.g. Raspberry Pi):

| Term length | Strategy | Cost |
|-------------|----------|------|
| `< 2` (e.g. `@`, `@a`, `@src/`) | `files.TopLevel(cwd, scope)` — a single `os.ReadDir` of one directory (depth 1) | O(children of one dir), no recursion |
| `>= 2` (e.g. `@app`, `@src/srv`) | `files.WalkScoped(cwd, scope, …)` — bounded recursive walk of **that scope's subtree only** | capped; cached ~5s |

Browsing and drilling into folders (`@src/` → `@src/lib/`) stay on the cheap
`ReadDir` path; only a real search term triggers a walk, and a *scoped* term
(`@src/foo`) walks just `src/`, not the whole tree.

## Request flow

```
keystroke (input event)
  → parseAtTrigger → trigger or close
  → open popup (loading), debounce ~120ms, AbortController cancels the prior request
  → chatApi.getFiles(id, query, { signal })
     → GET /api/files?id&q
        → resolveSessionCwd(id)              (shared with git.go)
        → scope, term := files.SplitQuery(q)
        → deep := len(term) >= 2
        → fileWalkCache.get(key(cwd,scope,deep)):   (~5s TTL, key per cwd+scope+mode)
             miss/expired → deep ? files.WalkScoped(cwd, scope) : files.TopLevel(cwd, scope)
        → files.Rank(entries, term, 20)      (pure scoring on basenames, top 20)
        → { "files": [ { path, isDir } ] }
  → renderFileList → .slash-item buttons (dirs show a trailing "/")
```

A stale response (superseded by a newer keystroke) or an `AbortError` is dropped.

## Selection

- **File** → replace the `@…` span with `path` + trailing space, close the popup.
- **Folder** → replace with `@path/` (the `@` is kept), leave the popup open; the
  dispatched `input` event re-triggers a scoped query so the user can drill in.

Arrow keys move the active row, `Enter`/`Tab` select it, `Escape` and an outside
click close. While the popup is open it consumes `Enter` so the message is not
submitted.

## Resource bounds (why this can't fan out)

The cwd may be a huge tree, and the user types fast, so every axis is bounded:

| Layer | Guard |
|-------|-------|
| Strategy | short queries use a single-directory `ReadDir`; the recursive walk only runs for `>= 2`-char terms, and only over the queried scope's subtree |
| Frontend | ~120ms debounce; `AbortController` cancels the in-flight request per keystroke; stale-response guard |
| Listing cache | one listing per `cwd`+scope+mode per ~5s window, shared across a keystroke burst |
| `files.WalkScoped` | caps on entries collected (`MaxEntries`), entries scanned (`MaxScanned`), and recursion depth (`MaxDepth`); skips heavy dirs (`.git`, `node_modules`, `vendor`, `dist`, …); **never follows symlinks** (bounds traversal *and* keeps results inside `cwd`) |
| `files.Rank` | pure, returns only the top 20 — the payload and DOM stay small, so no virtualization is needed |
| Path safety | results are `cwd`-relative and verified not to escape `cwd`; a missing/invalid `cwd` yields an empty list, not an error |

## Tests

- Go: `internal/files/files_test.go` (ranking, scoping, caps, heavy-dir skip,
  symlink no-follow, cwd containment); `internal/server/files_test.go` (handler
  status codes, ranked JSON, missing-cwd → empty, walk-cache TTL/keying).
- JS: `mention-autocomplete.test.js` (`parseAtTrigger`, render, insert file vs
  dir, keyboard nav); `chat-api.test.js` (`getFiles` URL + abort signal).
- E2E: `e2e/tests/mention-autocomplete.spec.ts` against a seeded temp `cwd`.
