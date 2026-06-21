# Sequence Flow: Chat Message

This flow covers a user typing a message (with optional image attachment) in the session page chat composer and sending it.

## Sequence Diagram

```
┌─────────┐   ┌─────────┐   ┌────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────┐
│ Browser │   │  Server │   │  sessions  │   │    chat      │   │   workers   │   │  pi rpc  │
│         │   │         │   │  (resolve) │   │  (request)   │   │  (manager)  │   │ (worker) │
└────┬────┘   └────┬────┘   └─────┬──────┘   └──────┬───────┘   └──────┬──────┘   └────┬─────┘
     │             │              │                  │                  │               │
     │ POST /api/chat?id=abc
     │ (multipart: message + images)
     │────────────▶│              │                  │                  │               │
     │             │              │                  │                  │               │
     │             │─── ResolveByID ────────────────▶│                  │               │
     │             │              │                  │                  │               │
     │             │◀───────────── Session + Path ────│                  │               │
     │             │              │                  │                  │               │
     │             │─── Check ChatAvailable ──────────│                  │               │
     │             │   (return 409 if disabled)       │                  │               │
     │             │              │                  │                  │               │
     │             │─── chat.ParseRequest(r) ────────▶│                  │               │
     │             │              │                  │                  │               │
     │             │              │─── ParseMultipartForm               │               │
     │             │              │─── Extract text + image files       │               │
     │             │              │─── Validate size / mime type        │               │
     │             │              │─── base64 encode images             │               │
     │             │              │                  │                  │               │
     │             │◀───────────── chat.Request ──────│                  │               │
     │             │   {Message, Images}               │                  │               │
     │             │              │                  │                  │               │
     │             │─── chatSender.Send(ctx, id, path, req) ──────────▶│               │
     │             │              │                  │                  │               │
     │             │              │                  │                  ├─── workerFor(id, path)
     │             │              │                  │                  │               │
     │             │              │                  │                  ├─── Get existing?
     │             │              │                  │                  │   ┌─ yes ─┐   │
     │             │              │                  │                  │   ▼       │   │
     │             │              │                  │                  │  use it   │   │
     │             │              │                  │                  │   │       │   │
     │             │              │                  │                  │   └───┬───┘   │
     │             │              │                  │                  │       │       │
     │             │              │                  │                  │   no  │       │
     │             │              │                  │                  │   ▼   │       │
     │             │              │                  │                  │─── factory(id, path)──▶│
     │             │              │                  │                  │       │       │
     │             │              │                  │                  │       │─── exec.Command("pi", "--mode", "rpc")
     │             │              │                  │                  │       │─── Start()
     │             │              │                  │                  │       │─── switch_session RPC
     │             │              │                  │                  │       │─── goroutines: consume stdout, wait
     │             │              │                  │                  │       │
     │             │              │                  │                  │◀────── ChatWorker ─│
     │             │              │                  │                  │               │
     │             │              │                  │                  ├─── worker.Prompt(ctx, chatReq)
     │             │              │                  │                  │               │
     │             │              │                  │                  │               ├─── touch() (update idle tracking)
     │             │              │                  │                  │               │
     │             │              │                  │                  │               ├─── BuildPromptCommand(id, chat, streaming)
     │             │              │                  │                  │               │
     │             │              │                  │                  │               ├─── sendAndAwait(ctx, cmd)
     │             │              │                  │                  │               │
     │             │              │                  │                  │               │─── Write JSONL to stdin
     │             │              │                  │                  │               │
     │             │              │                  │                  │               │─── Block on pending channel
     │             │              │                  │                  │               │
     │             │              │                  │                  │               │◀── consume() goroutine
     │             │              │                  │                  │               │    reads stdout line-by-line
     │             │              │                  │                  │               │    matches response by id
     │             │              │                  │                  │               │
     │             │              │                  │                  │               │─── Response arrives
     │             │              │                  │                  │               │─── status → idle
     │             │              │                  │                  │               │
     │             │              │                  │                  │◀────────────── nil
     │             │              │                  │                  │               │
     │             │◀───────────── nil ──────────────│                  │               │
     │             │              │                  │                  │               │
     │◀──────────── {ok: true, status: "accepted"} ─│                  │               │
     │             │              │                  │                  │               │
     │             │              │                  │                  │               │
     │             │              │                  │                  │               │
     │ GET /api/worker-status?id=abc
     │────────────▶│              │                  │                  │               │
     │             │─── computeRunningStatus ─────────────────────────▶│               │
     │             │              │                  │                  │               │
     │             │              │                  │                  ├─── Status()
     │             │              │                  │                  │   (may return running)
     │             │              │                  │                  │               │
     │◀──────────── {state: "running", model: "…", thinkingLevel: "…"} ─│                  │               │
     │             │              │                  │                  │               │
     │             │              │                  │                  │               │
     │  [Later]    │              │                  │                  │               │
     │  SSE: agent_end
     │◀──────────── event: reload ──────────────────────────────────────────────────────│
     │             │              │                  │                  │               │
     │  (browser reconciles from `/api/session`; interim assistant text may have appeared earlier via `chat-preview` SSE)
```

## Step-by-Step

### 1. User Submits Chat

Browser sends a `multipart/form-data` POST:

```
POST /api/chat?id=2026-01-15T10-30-00.000Z_a1b2c3d4.jsonl
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="message"

Hello, can you refactor this function?
------WebKitFormBoundary
Content-Disposition: form-data; name="images"; filename="screenshot.png"
Content-Type: image/png

<binary data>
------WebKitFormBoundary--
```

### 2. Request Parsing

`chat.ParseRequest`:

1. Sets `MaxBytesReader` (32 MB default)
2. Calls `ParseMultipartForm`
3. Extracts `message` text field
4. For each `images` file:
   - Read with `io.LimitReader` (10 MB per image)
   - Validate size
   - Detect MIME type (`http.DetectContentType`)
   - Reject non-image types
   - Base64 encode
5. Validate at least one of message or images is present

### 3. Worker Resolution

`workers.Manager.workerFor(sessionID, sessionPath)`:

```
Lock mutex
  Check existing worker for sessionID
    If exists and not error → return it
    If exists and error → close and delete
Unlock mutex

Create new worker: factory(sessionID, sessionPath)
  → rpc.NewPiWorkerWithStream(sessionPath, streamSink)

Lock mutex
  Double-check no race winner created one
  Store new worker
Unlock mutex

Return worker
```

### 4. RPC Prompt Command

`piRPCWorker.Prompt` builds and sends:

```json
{"id":"req-1","type":"prompt","message":"Hello, can you refactor this function?","images":[{"type":"image","data":"iVBORw0…","mimeType":"image/png"}],"streamingBehavior":"steer"}
```

If the worker is already in `running` state, `streamingBehavior` is `"steer"` to steer an ongoing stream instead of starting a new turn.

### 5. Response Handling

The `consume()` goroutine reads JSONL lines from `pi`'s stdout:

```
{"type":"response","id":"req-1","success":true}
```

It matches by `id` and delivers to the waiting `pending` channel. The worker then updates its status to `idle`.

### 6. Streaming Events

While the AI is generating, `pi` may emit stream events:

```
{"type":"message_update", …}
{"type":"message_update", …}
{"type":"message_end"}
{"type":"turn_end"}
{"type":"agent_end"}
```

These update `lastStreamActivity` so `Status()` continues to report `running` until the stream completes.

### 7. Error Handling

| Error | Response |
|-------|----------|
| Empty request | 400 `{"error": "message or image required"}` |
| Image too large | 413 `{"error": "image attachment too large"}` |
| Unsupported image type | 415 `{"error": "only image attachments are supported"}` |
| Session not found | 404 `{"error": "not found"}` |
| Chat disabled | 409 `{"error": "This session can be viewed, but chat is disabled because its working directory no longer exists."}` |
| RPC failure | 500 `{"error": "…"}` |

### 8. Worker Lifecycle

After 10 minutes of idle time (no user-initiated actions), the reaper goroutine closes idle workers to free resources.

### 9. Cancelling a Chat

`POST /api/chat/cancel?id=<id>` aborts the running worker, removes the terminal's session-status file, broadcasts a `reload` event, and returns `{"ok": true, "status": "cancelled"}`.

### 10. Model Switch Side Effect

`handleSetModel` updates the worker model via RPC. On success, the worker automatically refreshes its thinking level (`refreshThinkingLevel`) so the UI stays consistent.

### 11. Steering and Queuing

While a response is running the composer stays enabled and the toolbar swaps the
**Send** button for **Steer** plus a **Queue** button (`ChatToolbar.svelte`). A
docked panel (`QueuePanel.svelte`) appears above the textarea showing every
pending message — queued and in-flight steers alike — with keyboard navigation,
pause/resume, and per-row delete / send-now / edit actions.

- **Steer** sends the message immediately through the same `POST /api/chat` path.
  Because the worker is already `running`, `piRPCWorker.Prompt` tags the command
  `streamingBehavior:"steer"` (step 4) so pi folds it into the active turn. The
  message appears as a steer row in the panel until the run completes; the user
  can also dismiss the row early (the message is still with pi).
- **Queue** holds the message in the browser as a deletable row. There is no
  backend queue: when the worker transitions `running → idle` the composer fires
  `pi-worker-done` and the next queued message is sent as a fresh turn (one per
  completed run, in order) — unless the panel is paused.
- **Pause / Resume** (header button): pausing stops the auto-dequeue on
  `pi-worker-done`; resuming flushes the next item immediately if the worker is
  idle, otherwise the next `pi-worker-done` picks it up.
- **Keyboard** (inside the listbox): ↑↓ navigate, ⌫ delete the focused row, ↩
  send the focused queued message now, **E** pop the focused queued message back
  into the textarea for editing, Esc blur the panel.

State lives in `web/src/components/session/chat/queue-store.svelte.js` (a
Svelte 5 `$state` class with `items`, `paused`, `focusIndex`). The runtime glue
in `steer-queue.js` mutates the store from DOM events and installs `sendNow` /
`edit` / `resume` callbacks the panel calls back into. An `activeRun` flag —
driven solely by the `pi-chat-message-sent` (→ true) and `pi-worker-done`
(→ false) events — distinguishes the run-starting message from later steers, so
the first message of a run and auto-dequeued messages are never mistaken for
steers. Queued rows (and dismissed steers) are browser-local and dropped on
reload.

---

**E2E coverage:** `e2e/tests/chat.spec.ts` drives this flow end-to-end with a stub `pi` worker (`e2e/lib/stub-pi/pi`); `e2e/tests/steer-queue.spec.ts` covers the steer/queue flow. See [docs/dev/e2e-testing.md](../dev/e2e-testing.md).
