# End-to-End Testing (Playwright)

The `e2e/` project drives a real browser against the **built** `pi-web` binary.
It complements the Vitest unit tests (`web/`) and Go tests (`internal/`) by
exercising whole flows — page rendering, SSE live-reload, settings persistence,
and chat — across desktop, mobile, and iPad viewports.

It is intentionally **not** part of `make test` / `make check`: it needs browser
binaries and a running server, so it runs as its own target and CI job.

## Quick start

```bash
make e2e-setup           # one-time: install deps + Playwright browsers
make e2e                 # build the binary, then run the whole suite

# or, from e2e/ directly (assumes ./pi-web is already built):
cd e2e
npx playwright test                                  # all projects
npx playwright test --project="Desktop Chrome"       # one project
npx playwright test tests/chat.spec.ts               # one spec
npx playwright test --ui                             # interactive debug UI
npx playwright show-report                           # open last HTML report
```

`make e2e` runs `make build` first because of `//go:embed web/dist` — the binary
embeds the frontend, so E2E always runs against freshly built assets.

## Watching tests run (headed mode)

Tests run headless by default. To watch a real browser and verify with your own
eyes before trusting the headless run:

```bash
cd e2e

# Open a visible browser. Pin to ONE project or every browser launches at once.
npx playwright test --headed --project="Desktop Chrome"

# One window at a time (don't stack 7 browsers), good for watching a full file.
npx playwright test --headed --project="Desktop Chrome" --workers=1

# Step through interactively: pick tests, watch, re-run, inspect the DOM.
npx playwright test --ui

# Pause on the first action and drive it manually (Playwright Inspector).
PWDEBUG=1 npx playwright test --project="Desktop Chrome" tests/chat.spec.ts
```

Tips for eyeballing:
- Always add `--project=...` in headed mode — otherwise all 7 browsers open together.
- `--workers=1` runs tests one at a time so windows don't stack up.
- `--ui` (the Playwright UI runner) is usually the nicest way to watch + re-run.
- To slow actions, set `use: { launchOptions: { slowMo: 500 } }` temporarily in
  `playwright.config.ts`, or use `PWDEBUG=1` to step manually.
- Headed vs. headless is just a flag — the same specs run both ways, so once it
  looks right headed, drop `--headed` to go back to fast/CI mode.

## Project matrix

Layout follows a **900px breakpoint**, not device type. Seven projects:

| Project | Engine | Viewport | Layout |
|---|---|---|---|
| Desktop Chrome | Chromium | 1280 | desktop |
| Desktop Firefox | Firefox | 1280 | desktop |
| Desktop Safari | WebKit | 1280 | desktop |
| Mobile Chrome (Pixel 5) | Chromium | 393 | mobile |
| Mobile Safari (iPhone 13) | WebKit | 390 | mobile |
| iPad (gen 7) | WebKit | 810 portrait | mobile |
| iPad landscape | WebKit | ~1080 | desktop |

These are Playwright **device emulation** (real viewport/touch/UA/DPR, desktop
engine binary), not real devices. `webkit` is the Safari *engine*, not literal
Safari.app — good enough for layout/touch regressions and runs on Linux CI.

Tests that depend on layout resolve it at runtime with `isMobileLayout(page)`
(checks `matchMedia('(max-width: 900px)')` **after navigation** — about:blank
does not reflect the project viewport) and `test.skip()` the half that doesn't
apply. iPad portrait exercises mobile, iPad landscape exercises desktop.

### Expected skips

A full run reports **13 skipped** — these are intentional `test.skip()` guards,
not failures:

- **7** from `mobile-layout.spec.ts`: it has a mobile test and a desktop test;
  each skips on the projects whose layout doesn't apply (mobile test skips the 4
  desktop-layout projects, desktop test skips the 3 mobile-layout projects).
- **6** from `settings.spec.ts` → "persists a setting server-side across
  reload": settings live in one global server-side store, so running it on all 7
  projects in parallel would race on the same key. It's gated to Desktop Chrome
  (persistence is browser-independent), so the other 6 projects skip it.

So `92 passed + 13 skipped + 0 failed` is the healthy state. Each skip carries a
reason string, visible with `npx playwright test --reporter=list`.

## How the server runs (scripted launch)

`global-setup.ts` (see `e2e/lib/server.ts`):

1. Ensures `./pi-web` exists (CI builds it first; locally `make build` if missing).
2. Creates a temp `PI_CODING_AGENT_DIR` and copies `e2e/fixtures/sessions/` into it.
3. Picks a free port and starts `pi-web -host 127.0.0.1` (the `-host` flag skips
   Tailscale auto-serve; auth is disabled).
4. Prepends `e2e/lib/stub-pi/` to `PATH` so chat spawns the stub, never real pi.
5. Writes `{ baseURL, sessionsDir, agentDir, pid }` to `e2e/.tmp/server.json`.

The base fixture in `e2e/lib/test.ts` reads that file to set each test's
`baseURL` and to expose `sessionsDir` to mutating specs. `global-teardown.ts`
kills the server and removes the temp dir.

## Fixtures (sanitized real sessions)

Read-only specs assert against committed fixtures in `e2e/fixtures/sessions/`,
derived from **real** pi sessions and scrubbed. Regenerate with:

```bash
cd e2e
node scripts/sanitize-session.mjs <path-to-real-session.jsonl> \
  --name demo.jsonl --cwd /home/user/demo-project
```

The script rewrites home paths/username, redacts secret-shaped strings and
emails, and neutralizes the cwd + encoded directory name, while preserving entry
structure so the viewer still renders faithfully. **Always eyeball the output
before committing** — automated redaction is a safety net, not a guarantee.

Mutating specs don't touch the committed fixtures: live-reload and chat each
create a uniquely-named session file (`e2e/lib/sessions.ts`) inside an
already-watched subdir, so the 7 parallel projects never collide.

## The stub `pi`

Chat uses a `pi --mode rpc` worker (`internal/rpc`). CI has no real pi and no API
keys, so `e2e/lib/stub-pi/pi` answers the line-delimited JSON protocol:

- `switch_session` → remembers the session file path.
- `get_state` / `set_model` / `set_thinking_level` / `abort` → acknowledge.
- `prompt` → acks, then appends a user turn + a deterministic
  `Stub reply: <prompt>` assistant turn to the session JSONL (like real pi owns
  the file) and emits `message_update` / `message_end` / `turn_end` / `agent_end`.

The browser surfaces the reply through the same fsnotify → SSE reload path as a
real session. To extend chat coverage, add command handling in the stub mirroring
the real protocol in `internal/rpc/client.go`.

Note: chat is disabled ("View only") when a session's `cwd` doesn't exist on
disk, so chat specs build sessions with a real temp `cwd` (`realWorkingDir()`).

## CI

The `e2e` job in `.github/workflows/ci.yml`: `npm ci` →
`playwright install --with-deps chromium firefox webkit` → `make build` →
`npx playwright test`. The HTML report + traces upload as artifacts on failure
(`trace: on-first-retry`, `retries: 1` in CI).

## Adding a test

1. Put the spec in `e2e/tests/*.spec.ts` and import `{ test, expect }` from
   `../lib/test` (not `@playwright/test` directly) so `baseURL`/`sessionsDir` are wired.
2. For layout-specific assertions, gate on `isMobileLayout(page)` after navigating.
3. On narrow viewports the scratchpad overlays the header/composer — call
   `collapseScratchpad(page)` before `goto` (see chat/mobile specs).
4. For anything that writes to a session, create a per-test file via
   `e2e/lib/sessions.ts`; never mutate the committed fixtures.

Keep this doc in sync when specs, fixtures, or the project matrix change.
