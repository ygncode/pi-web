# Sequence Flow: Schedules

Schedules run pi automatically on a cadence (or on demand). When a schedule
fires it creates a **fresh pi session**, sends the schedule's instructions as the
first message, and lets pi run autonomously. Each firing is recorded so the
created sessions can be tagged, filtered, and surfaced in a run log — and so a
schedule-specific push notification can be sent when the run finishes.

Scheduling state lives in SQLite (`pi-web.sqlite`), not in pi's session files.
The `internal/schedules` package owns the store and the cron math; the firing
loop and the session-creating runner live in `internal/server` because they need
the chat workers and SSE broadcast.

## Data model (SQLite)

`schedules` — one row per definition:

| column | notes |
|--------|-------|
| `id` | UUID |
| `name`, `instructions` | required |
| `model_provider`, `model_id`, `thinking_level` | optional → pi defaults |
| `project_path` | optional → user home dir |
| `cron_expr` | empty = manual (Run-now only) |
| `timezone` | IANA name; empty = server local |
| `enabled` | bool |
| `last_run_at` | last fire time |

`schedule_runs` — one row per firing; also the **session → schedule mapping**:

| column | notes |
|--------|-------|
| `schedule_id` | FK |
| `session_id` | created session UUID (filled after resolve) |
| `session_file` | created `.jsonl` filename |
| `fired_at`, `status`, `error` | `running` \| `error` |

## Firing sequence

```
┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐   ┌──────────┐
│ scheduler│   │ schedules    │   │   sessions   │   │  workers   │   │   push   │
│  (loop)  │   │  (store)     │   │ (create file)│   │ (manager)  │   │ (manager)│
└────┬─────┘   └──────┬───────┘   └──────┬───────┘   └─────┬──────┘   └────┬─────┘
     │                │                  │                 │               │
     │ every 30s: evaluateSchedules()    │                 │               │
     │── List() ─────▶│                  │                 │               │
     │◀── schedules ──│                  │                 │               │
     │                │                  │                 │               │
     │ for each enabled cron schedule:   │                 │               │
     │   next = NextFire(cron, tz, now)  │                 │               │
     │   (first sight only arms it —     │                 │               │
     │    missed past runs are skipped)  │                 │               │
     │                │                  │                 │               │
     │ when now >= next → fireSchedule() │                 │               │
     │── RecordRun(running) ────────────▶│                 │               │
     │── SetLastRun ────────────────────▶│                 │               │
     │── CreateSessionFileWithSettings ───────────────────▶│               │
     │   (project dir or home; model/thinking as implicit entries)        │
     │◀── filename ──────────────────────────────────────│               │
     │── ResolveByID ────────────────────────────────────▶│               │
     │◀── session UUID + path ───────────│                 │               │
     │── AttachSession(runID, uuid) ────▶│                 │               │
     │                │                  │                 │               │
     │── EnsureWorker(uuid, path) ───────────────────────▶│               │
     │── Send(uuid, path, {instructions}) ───────────────▶│─── pi runs ──▶│
     │                │                  │                 │               │
     │  (file watcher sees the new .jsonl → broadcasts `new-session`)     │
     │                │                  │                 │               │
     │  [run completes; worker → idle]   │                 │               │
     │  recomputeAndBroadcastStatus: running → idle        │               │
     │  scheduleNameForSession(uuid)? ──▶│                 │               │
     │◀── name, true ────────────────────│                 │               │
     │── NotifyScheduleDone(name, uuid) ─────────────────────────────────▶│
     │                │                  │                 │   web push ──▶ browser
```

## Manual / Run-now

A schedule with an empty `cron_expr` never fires on the timer. Any schedule can
be fired immediately via `POST /api/schedule/run?id=<id>`, which calls the same
`fireSchedule` path and returns the created `sessionId` so the UI can navigate to
it.

## Missed runs

Schedules only fire while pi-web is running. On startup (and on first sight of
any schedule) the loop computes the next fire time from *now*, so occurrences
that elapsed while the process was down are **skipped** rather than replayed.

## HTTP endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/schedules` | list (with computed `nextRunAt`) |
| POST | `/api/schedules` | create |
| GET | `/api/schedule?id=` | read one |
| POST/PUT | `/api/schedule?id=` | update |
| DELETE | `/api/schedule?id=` | delete (and its runs) |
| POST | `/api/schedule/run?id=` | Run-now |
| GET | `/api/schedule/runs?id=` | run log |

The `/schedules` page itself is the SPA shell (served by the catch-all index
route); the Svelte router renders `SchedulesPage.svelte`.

## Push notifications

Scheduled runs reuse the web-push subsystem ([share.md](./share.md) covers VAPID
setup). On the running→idle transition, `recomputeAndBroadcastStatus` checks
whether the session was schedule-created; if so it sends `NotifyScheduleDone`
(payload `type: "schedule-done"`) instead of the generic `session-done`. The
service worker (`internal/ui/embedded/assets/sw.js`) shows `schedule-done`
notifications **even when the app is foregrounded**, since a scheduled run is a
background event the user may not be watching.

## Frontend frequency presets

The editor offers presets (hourly, daily, weekdays, weekly) plus a raw custom
cron field and a manual option. Presets compile to a standard 5-field cron
expression client-side (`web/src/index/schedules.js` `buildCron`), and
`parseCron` recovers the preset + fields when editing an existing schedule.
