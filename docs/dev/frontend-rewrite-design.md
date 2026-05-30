# Frontend Rewrite Design

> **Historical note:** Alpine.js was removed from the project in favor of vanilla JS
> with explicit DI (`documentImpl`, `windowImpl`). The index page (`/`) now uses the
> same vanilla module pattern as the session page. This doc describes a direction
> that was evaluated and rejected.

## Agreed direction
Rewrite the whole app frontend, not just the sessions index. Today the live frontend is mixed across Go templates, live template CSS, raw live reload code, and Vite entrypoints, while standalone export code lives under `internal/ui/live_templates/export/`. The target is a cohesive live frontend that is built by Vite and embedded into the Go binary.

The rewrite should preserve current user-visible behavior and visual design first. Architecture comes before redesign. New packages are allowed when they solve a clear problem, but the app must remain self-contained and embeddable in Go.

## Goals
- Move all application behavior into explicit frontend modules with clear ownership.
- Keep Go templates focused on HTML shell, initial data injection, and server-rendered fallback content where needed.
- Use vanilla JS modules with explicit DI as the interaction/state layer.
- Use Vite as the build boundary for all app frontend assets.
- Embed the built frontend inside the Go binary using the existing `web/dist` + `//go:embed` flow.
- Preserve current UI/UX initially so the rewrite is reviewable and testable.
- Make future features easier: chat, live updates, session tree, filtering, model controls, sharing, and mobile behavior should not require editing unrelated files.

## Non-goals for the first rewrite pass
- No intentional backend API changes.
- No intentional visual redesign.
- No partial cleanup that leaves major behavior split between inline template JS and Vite modules.
- No runtime dependency on external CDNs or unembedded assets.

## Current problems
- Standalone export behavior is split across many ordered files in `internal/ui/live_templates/export/app/*.js`, while live session behavior is Vite-owned.
- CSS is concentrated in large template files, making shared tokens/components hard to evolve.
- Index, live, session viewer, and chat have different frontend ownership patterns.
- Inline template JavaScript makes testing, bundling, and dependency management harder.
- Feature boundaries are unclear: rendering, navigation, filtering, event streams, composer state, API calls, and storage are interleaved.

## Target architecture

```text
web/src/
  app/                  # app bootstrap and module registration
  shared/               # API, storage, events, DOM, formatting, escape helpers
  design/               # tokens, base CSS, layout CSS, component CSS
  index/                # sessions index page
  session/              # session viewer page
    data/               # initial data parsing/adapters
    tree/               # branch/tree model and filtering
    render/             # message/content renderers
    navigation/         # selection, deep links, keyboard/mobile navigation
    chat/               # composer, attachments, model/thinking controls
    live/               # SSE reload/status/preview handling
  live/                 # standalone live entrypoint if still needed
```

### Go/template boundary
- Go templates should emit page shells and serialized initial data only.
- Avoid large inline scripts in `internal/ui/live_templates/index.html` and `internal/ui/live_templates/session.html`.
- Vite entrypoints should own frontend behavior:
  - `src/index/index.js`
  - `src/session/session.js`
  - `src/live/live.js` if still needed after consolidation
- Built assets stay under `web/dist` and are embedded into the Go binary.
- Manifest lookup should support the needed entrypoints instead of assuming only index behavior matters.

### UI state layer
- Vanilla JS remains the primary UI state and interaction layer.
- Register module components/stores from Vite entrypoints.
- Keep component factories testable without requiring a browser page boot.
- Prefer small focused modules over one global object that owns the whole app.

### Package policy
- Packages are allowed when necessary for maintainability, parsing, rendering, or UX.
- Prefer small, well-maintained packages.
- Avoid packages that require external services, CDNs, or complicated runtime asset loading.
- Any package must work with Vite build output embedded in Go.

## Migration strategy
This is a whole-app rewrite, but it should still be test-driven and reviewable.

1. Characterize current behavior with tests before replacement.
2. Build the new module structure under `web/src`.
3. Move index, session viewer, live updates, chat composer, and CSS into the Vite-owned frontend together so the app has one architecture.
4. Keep Go API contracts and data shapes stable.
5. Remove obsolete inline/template JS only after equivalent Vite modules are tested and wired.
6. Refactor once tests are green.

## First implementation milestone
Rewrite the full frontend architecture in the isolated worktree:
- Sessions index state/search/new-session/live status.
- Session viewer tree, filters, message rendering, deep links, mobile sidebar behavior.
- Chat composer, attachments, model selector, thinking selector, worker/live status.
- Shared SSE/event-source lifecycle.
- Shared API client and storage helpers.
- Shared CSS tokens/components/layout files built by Vite and embedded by Go.

## Testing plan
- Add failing tests before each migrated behavior.
- Keep existing Go tests green and update them when they assert old file locations instead of behavior.
- Frontend tests should cover module-level behavior without requiring a full browser server.
- Add integration-style tests for template/manifest wiring where useful.
- Run `make check` before claiming completion.

## Verification before completion
- `npm --prefix web run test`
- `npm --prefix web run build`
- `go test ./...`
- `go vet ./...`
- Prefer `make check` as the single full verification command.

## Worktree lifecycle
Implementation happens in `.worktrees/frontend-scalable-rewrite` on branch `frontend-scalable-rewrite`. Keep the worktree alive across review and merge. Only delete it when explicitly approved.
