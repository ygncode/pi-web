# Sequence Flow: btw scratch-chats

A **btw** ("by the way") is a throwaway, floating chat window attached to a
session page. It lets you start a quick side conversation with a fresh `pi`
worker without leaving — or disturbing — the session you're reading. Each btw is
backed by a real session file on disk, but it is registered in a separate table
so it can be **hidden from the index** and **reaped when its parent disappears**.

Backend: `internal/server/btw.go`. Frontend: `web/src/session/` btw window (user
strings under the `btw.*` / `settings.showBtw*` keys in
`web/src/shared/locales/en.js`).

## Data model

btw chats live in their own SQLite table (created in `server.New`):

```sql
CREATE TABLE IF NOT EXISTS btw_sessions (
    btw_id    TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL,
    active    INTEGER NOT NULL DEFAULT 1
)
```

- **One active btw per parent.** Each parent session page has at most one
  `active=1` btw. Pressing **new** orphans the previous one (`active=0`) but keeps
  the row and the file on disk, so orphaned btws stay identifiable and hideable
  for their whole lifetime.
- **`parent_id`** is the session the btw was opened from. A btw opened with no
  parent uses the `__global__` sentinel (`btwGlobalParent`) — the slot the legacy
  single global btw migrates into.
- **Legacy migration** (`migrateLegacyBtwSession`): the old single-row
  `app_settings` pointer (`btw_session_id`) is moved into `btw_sessions` under
  `__global__` on startup, then the legacy key is deleted. Idempotent.

## Open / resume: `GET /api/btw?parent=<id>`

`handleGetBtw` returns the active btw id for a parent, or `""` (empty state):

1. Look up the `active=1` row for the (normalized) parent.
2. If an id is found but its **session file no longer exists**, delete the
   registry row, broadcast `btw-changed` with an empty id, and return `""` so the
   client falls back to its empty state.
3. Respond `{"sessionId": id}`.

## New: `POST /api/btw/new`

`handleNewBtw` body: `{ "path": "<cwd>", "parent": "<parent session id>" }`.

1. Default `path` to the user's home directory when omitted.
2. `CreateSessionFileWithSettings` writes a fresh JSONL session file.
3. `setBtwSessionID(parent, id)` records it as the active btw for that parent,
   **orphaning the prior active btw** in a single transaction (`active=0` for the
   parent, then upsert the new row `active=1`).
4. On a real change, **broadcast `btw-changed`** (`{sessionId}`) on the parent's
   SSE topic so other devices viewing that page re-sync in realtime.
5. Pre-warm a `pi --mode rpc` worker (mirrors `handleNewSession`) so the first
   message lands quickly.
6. Respond `{"ok": true, "id": id}`.

From here, chatting in the btw window uses the normal chat path
(`POST /api/chat`, see [chat.md](./chat.md)) against the btw's session id — a btw
is an ordinary session as far as the worker is concerned.

## Index hiding

btw chats are **hidden from the sessions list by default**:

- `showBtwInIndex()` reads the `pi-web:v1:show-btw-in-index` setting (default
  `false`; toggled on the `/settings` page — `settings.showBtw`).
- `filterBtwSummaries(...)` drops every id in `btwSessionIDs()` (all btws, active
  or orphaned) from the list unless showing is enabled. Applied server-side in the
  index/sessions handlers, so there is no client flash.

## Reaping orphans

`reapOrphanedBtw(all)` keeps btws from outliving their parent. Given the full,
unfiltered session list it deletes — **both the registry row and the session
file** — every btw whose `parent_id` is neither `__global__` nor a still-existing
session. The `__global__` sentinel parent is never reaped.

## SSE

| Event | Topic | Payload | Meaning |
|-------|-------|---------|---------|
| `btw-changed` | parent session id (or `__global__`) | `{"sessionId": "<id or empty>"}` | The active btw for this parent changed (created, switched, or cleared). Windows opened from that page re-sync; empty id means "no btw". |
