# Sequence Flow: Annotations

Annotations are reviewer-authored notes anchored to a span of a rendered session
entry **or** an artifact's source. They are persisted server-side (SQLite),
synced across open tabs over SSE, and can be packaged into a message back to the
agent ("send notes to pi").

They are **not** session data — they never touch the append-only JSONL. They are
overlay metadata keyed by session id.

## Anchoring model

An annotation does not store a DOM range (those die on re-render). It stores a
**stable text anchor**:

| Field | Meaning |
|-------|---------|
| `anchorId` | `entry-<id>` for a transcript message, or `artifact-<id>` for an artifact's source `<pre>` |
| `startOffset` / `endOffset` | character offsets `[start, end)` into the anchor element's `textContent` |
| `original` | the anchored text at creation time (for display + drift awareness) |
| `text` | the reviewer's note |
| `kind` | `comment` (the only kind today) |
| `source` | `local` (room for imported/remote annotations later) |

Because the session view rebuilds `#messages` on navigation/live-reload and the
artifact panel rebuilds its host on every selection, highlights are **recomputed
from offsets** rather than kept as live nodes. See "Highlight (re)application".

Frontend modules (`web/src/session/annotations/`):

- `annotation-range.js` — selection → `{anchorId, start, end, text}`, and
  wrapping a `[start,end)` range in `<mark class="pi-annotation">`
- `annotation-api.js` — `list` / `create` / `remove` against `/api/annotations`
- `annotation-layer.js` — orchestration: selection popover, the note modal,
  highlight application, the Annotations tab list, and send-to-pi

Backend: `internal/server/annotations.go` (table, handlers, SSE broadcast),
wired in `server.go`.

## Create flow

```
┌─────────┐   ┌───────────────────┐   ┌──────────┐   ┌─────────────┐
│  User   │   │ annotation-layer  │   │  Server  │   │ Other tabs  │
│ (browser)│  │  (this tab)       │   │          │   │ (same sess) │
└────┬────┘   └─────────┬─────────┘   └────┬─────┘   └──────┬──────┘
     │                  │                  │                │
     │ select text in   │                  │                │
     │ #messages /      │                  │                │
     │ artifact source  │                  │                │
     │─────────────────▶│ mouseup OR       │                │
     │                  │ selectionchange  │                │
     │                  │ (debounced)      │                │
     │                  │── getSelectionInfo (anchorId,start,end,text)
     │                  │── show "Comment" button at selection rect
     │                  │                  │                │
     │ tap "Comment"    │                  │                │
     │─────────────────▶│── open note modal (focus textarea)
     │ type note, Save  │                  │                │
     │─────────────────▶│                  │                │
     │                  │── optimistic add + render highlight (mark)
     │                  │   POST /api/annotations?session=ID │
     │                  │─────────────────▶│                │
     │                  │                  │── INSERT row   │
     │                  │                  │── broadcastAnnotations(ID)
     │                  │                  │   SSE: annotations (snapshot)
     │                  │                  │───────────────────────────▶
     │                  │   200 { annotation } (real id)    │
     │                  │◀─────────────────│                │
     │                  │── refresh(): GET /api/annotations → reconcile
     │                  │                  │                │── setAnnotations(snapshot)
     │                  │                  │                │   re-render highlights + list
```

Key points:

- **Trigger.** `mouseup` covers desktop; `selectionchange` (debounced ~250ms)
  covers touch, where finishing a selection often fires no `mouseup`. Both call
  the same `maybeShowFromSelection()`.
- **Note input is a modal**, not an inline box — on mobile it must not be
  confused with the chat composer and must sit above the keyboard.
- **Optimistic + guarded.** The note is added locally and highlighted before the
  POST resolves. A monotonic load counter ensures a slow in-flight `list()` can't
  clobber a newer optimistic create or SSE snapshot.
- **Reveal on save.** Saving fires the layer's `onCreate` callback, which
  `session.js` wires to open the right sidebar if it's collapsed and switch to the
  Annotations tab — so the just-created note is always visible where it lands.

## Load flow

On session page init (`session.js`), `annotationLayer.init()` calls
`refresh()` → `GET /api/annotations?session=<id>` → `applyHighlights` across all
scopes + render the Annotations tab list + update the tab count badge.

## Delete flow

Clicking a note's delete button optimistically removes it, then
`DELETE /api/annotations?session=<id>&id=<annId>`. The server removes the row and
broadcasts a fresh `annotations` snapshot.

## Storage & endpoint

SQLite table `annotations` (`~/.pi/agent/pi-web.sqlite`), keyed by session id,
indexed on `session_id`. The DB pool is capped to one connection
(`SetMaxOpenConns(1)`) so concurrent writers queue rather than failing with
"database is locked".

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/api/annotations?session=<id>` | `handleListAnnotations` | `{ annotations: [...] }` |
| POST | `/api/annotations?session=<id>` | `handleCreateAnnotation` | body = annotation; server fills `id`/`kind`/`source`/`createdAt`; upsert by `id` |
| DELETE | `/api/annotations?session=<id>&id=<annId>` | `handleDeleteAnnotation` | |

Every POST/DELETE calls `broadcastAnnotations(sessionID)`.

## SSE event

| Event | Topic | Payload | Trigger |
|-------|-------|---------|---------|
| `annotations` | `sessID` | `{ "type": "snapshot", "annotations": [...] }` | a note is created/deleted for that session |

A **snapshot** (full set) is sent rather than granular add/remove events — the
client just calls `setAnnotations(...)` and re-renders. Wiring:
`live/live-events.js` (`onAnnotations`) ← `live/live-reload-runner.js` ←
`session.js` (`onAnnotations: (list) => annotationLayer.setAnnotations(list)`).

## Highlight (re)application

`applyHighlights(scope, annotations)` unwraps existing `.pi-annotation` marks in
a scope, then for each annotation finds its anchor by id and wraps the
`[start,end)` run in a `<mark class="pi-annotation" data-annotation-id>`.

The layer holds **scopes** = `[#messages, #artifact-panel-host]`. A single
`MutationObserver` watches them; when a scope re-renders, `reapply()` runs
(disconnect → apply to every scope → reconnect, so it never observes its own
mutations). The Annotations tab "jump" on an artifact note first asks the panel
to select that artifact (so its source `<pre>` exists) before scrolling.

## Send to pi

The Annotations tab's "Send N notes to pi" button formats the set and fills (does
**not** submit) the chat composer (`#pi-chat-message`). Notes are grouped:

- artifact notes under `In <file path>:` with a `Line N` / `Lines N-M` reference
  computed from the offsets against the file content;
- transcript notes under `In this conversation:`.

The message opens with an explicit, directive framing ("…continuation of our
current task, not a new or separate request") so a weaker model treats it as
follow-up edits rather than a fresh conversation.

On mobile the sidebar is a full-screen overlay, so sending fires the layer's
`onSend` callback — `session.js` wires it to collapse the right sidebar (mobile
only) before the composer is focused, so the filled composer is actually visible
and ready to type into.

## Live-only

Like artifacts, the annotation layer mounts only on the live session page
(`IsLive`). Exported Gist snapshots have no annotation host, server, or SSE, so
the layer is a no-op there.

---

**E2E coverage:** `e2e/tests/annotations.spec.ts` annotates a transcript message
and an artifact's source, asserts the highlight + Annotations entry, deletes a
note, and verifies send-to-pi fills the composer with the file path + line
number. See [docs/dev/e2e-testing.md](../dev/e2e-testing.md).
