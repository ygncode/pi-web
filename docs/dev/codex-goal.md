Refactor the pi-web frontend session architecture according to the plan in plan.md.

Goal: reduce SessionPage.svelte complexity, replace implicit window bridges with explicit runtime context where possible, strengthen live/export boundaries, and improve maintainability without changing user-visible behavior.

Important constraints:
- Do not rewrite the app from scratch.
- Do not merge live app and export paths.
- Do not break static export/share.
- Do not remove all window.* bridges in one risky change; replace them incrementally with compatibility shims where needed.
- Preserve current behavior for chat, SSE live reload, annotations, artifacts, navigation, session tree, right sidebar, keyboard shortcuts, settings, and export.
- Keep changes small and testable.
- Follow existing project architecture and docs, especially:
  - AGENTS.md
  - docs/architecture/system-overview.md
  - docs/dev/templates-vs-web.md
  - docs/sequence-flows/chat.md
  - docs/sequence-flows/live-reload.md
  - docs/sequence-flows/artifacts.md
  - docs/sequence-flows/annotations.md

Implementation plan:

1. Add explicit session runtime context
   - Create a focused runtime context module, likely:
     web/src/session/session-runtime-context.js
   - It should expose APIs similar to:
     setSessionRuntime(...)
     getSessionRuntime(...)
     resetSessionRuntimeContext(...)
   - Runtime context should hold explicit references for:
     model
     navigator
     navigateTo
     reconcileEntries
     contentRuntime
     annotations/artifacts hooks if appropriate
   - Keep existing window.* bridges as temporary compatibility shims if still required:
     window.navigateTo
     window.__piSessionDataModel
     window.__piReconcileEntries
     window.__piContentRuntime
   - Prefer new code using context instead of window.

2. Shrink SessionPage.svelte
   - Extract session loading/model hydration into a focused module, likely under:
     web/src/session/page/
   - Extract layout/body class handling into a focused helper.
   - Extract navigation setup into a focused helper.
   - Extract annotation setup into a focused helper.
   - Extract runtime bootstrapping into a focused helper.
   - Keep SessionPage.svelte mostly declarative: load state, initialize runtime, render components.
   - If useful, create:
     web/src/components/session/SessionShell.svelte
     to hold the large rendered session component tree.

3. Preserve session behavior
   - SessionPage must still:
     load session data from the existing API/bootstrap flow
     hydrate SessionDataModel
     set document title
     support navigateTo behavior
     support LiveReload reconciliation
     support ChatComposer
     support annotations
     support artifacts/right sidebar
     support keyboard shortcuts
     support lazy highlighting
     cleanup all runtime/global listeners on unmount

4. Replace window bridges gradually
   - Migrate direct consumers to the new runtime context where practical.
   - Keep compatibility aliases only when needed.
   - Add comments marking remaining window bridges as temporary compatibility shims.
   - Do not remove a bridge unless tests and source search confirm it is unused.

5. Strengthen export/live boundary safety
   - Add or improve tests that prevent export-reachable code from importing live-only modules.
   - Export must not import or bundle:
     web/src/session/chat/
     web/src/session/live/
     web/src/session/session-globals.js
     web/src/components/session/ChatComposer.svelte
     web/src/components/session/LiveReload.svelte
   - Preserve existing TestExportBundleIsSelfContained behavior.
   - Add a source-level import-boundary test if appropriate so violations fail earlier.

6. CSS
   - Do not do a large CSS migration.
   - Only make CSS changes if required by component extraction.
   - Keep global/shared CSS in internal/ui/embedded/styles unless there is a very low-risk component-specific move.
   - Preserve live/export styling.

7. Tests and validation
   - Add/update tests for new helper modules.
   - Update existing tests only where refactor changes structure, not behavior.
   - Run relevant frontend tests.
   - Run Go tests if export boundary or embed-related code changes.
   - Prefer:
     npm test -- --run
     go test ./...
     make build
   - If full test/build is too slow, run targeted tests first, then clearly run broader validation before finishing.

Acceptance criteria:
- SessionPage.svelte is significantly smaller and easier to read.
- Session boot logic is split into focused modules with clear names.
- New session runtime context exists and is used by new/refactored code.
- Remaining window.* bridges are minimized and documented as compatibility shims.
- Live session behavior remains unchanged.
- Static export remains self-contained and does not import live-only modules.
- Existing tests pass, and new tests cover important extracted helpers/boundary checks.
- No unrelated UI/behavior changes are introduced.

Work continuously through the full refactor. Do not stop after only writing a plan. Implement, test, fix regressions, and only finish when the acceptance criteria are met.
