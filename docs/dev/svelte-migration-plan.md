# Frontend → Full Svelte 5 Migration Plan

**Status:** approved, ready to execute. **Owner:** intern bring-up (or autonomous goal).

This plan is **self-contained and executable without further questions** — the
four shaping decisions below are already locked. Do not re-open them; if a new
question arises, prefer the lower-risk option and note it in the PR.

## Locked decisions

| Decision | Choice | Consequence |
|---|---|---|
| Export/share snapshot | **Full Svelte everywhere** | Export mounts the *same* Svelte components as the live app, rendered once (no SSE/chat/fetch). Shared components must never import a live-only module. |
| Test strategy | **Full rewrite** | Replace all `jsdom` + `documentImpl`/`windowImpl` DI tests with `@testing-library/svelte`. Retire the DI plumbing once a module's tests are ported. |
| TypeScript | **Defer** | Migrate to `.svelte` / `.svelte.js` (plain JS) now. `.ts` conversion is a separate follow-up. |
| Rollout gate | **None — straight into full migration** | No proof-of-concept gate. Still phase-by-phase with green CI per phase (no big-bang branch). |

## Goal & success criteria

Replace the hybrid (Svelte shells delegating to vanilla `innerHTML` runtimes)
with self-contained Svelte 5 components + `.svelte.js` reactive models, used by
**both** the live SPA (`web/src/main.js`) and the static export
(`web/src/export/`).

**Done when:**

1. No `web/src/**/*.js` performs `innerHTML`-based view rendering. (Pure data/util
   modules and `.svelte.js` reactive models are fine.)
2. The live app and export render from the **same** Svelte components.
3. `TestExportBundleIsSelfContained` passes **and is hardened** (see §6).
4. `make check` (Go test+build+vet), `web` `npm run test`, and `make e2e` are all
   green.
5. `npm run knip` reports no leftover dead modules from the list in §8.
6. The deleted-module list in §8 is fully removed.

**Non-goals (this effort):** TypeScript, visual redesign, changing the Go
backend beyond the export guard test, touching `web/src/shared/locales/*`.

---

## 1. Ground truth (measured, not estimated)

Inventory taken from the repo, not the docs. Use these numbers to re-baseline —
the earlier "5000→2500 LOC" figure was wrong.

- Non-test `.js` under `web/src`: **~18,855 LOC** (incl. ~4,400 LOC of
  `locales/*` that do **not** change).
- `.svelte` today: **~957 LOC** (thin shells only).
- `.test.js`: **~8,633 LOC** — the largest single body of work. Full rewrite.
- `.svelte.js` files today: **0** (the reactive-model pattern is net-new).
- Biggest modules: `chat/chat-composer-runner.js` (1121), `index/index.js`
  (718), `session/session.js` (692), `render/session-entry-renderer.js` (638),
  `live/btw-popup.js` (621).

### The shared (live + export) set — authoritative

Export reuse is defined by **what `web/src/export/export-entry.js` imports
today**. These 15 modules (and only these) are rendered in both contexts and
must become **shared, live-safe** components / `.svelte.js`:

```
data/session-data.js            tree/session-tree.js        tree/session-filter.js
render/session-format.js        render/markdown.js          render/session-header-renderer.js
render/session-entry-renderer.js tree/tree-renderer.js      navigation/session-navigation.js
ui/toggle-state.js              ui/sidebar.js               ui/search-filters.js
ui/session-ui-runner.js         ui/image-modal.js           shared/keyboard-nav.js
```

**Everything else under `web/src/session/`, `web/src/index/`,
`web/src/settings/` is live-only** and may freely use SSE / `fetch` / `onMount`.

### Tooling already present (no install needed)

`svelte@5.56.2`, `@sveltejs/vite-plugin-svelte@7.1.2`, `vite`, `vitest`,
`jsdom`, `knip`. `web/vitest.config.js` already wires the svelte plugin +
`environment: 'jsdom'`.

### Tooling to ADD (Phase 1)

```
npm i -D @testing-library/svelte @testing-library/jest-dom @testing-library/user-event
```

Add a vitest setup file (`web/vitest.setup.js`) importing
`@testing-library/jest-dom/vitest` and register it via `test.setupFiles` in
`web/vitest.config.js`.

### Build pipeline facts (don't rediscover these)

- `web/package.json` `build` = `vite build` (live → `dist/`, manifested) **+**
  `build:export`.
- `build:export` = `vite build --config vite.config.export.js`
  (→ `dist-export/export.js`, single IIFE) **+** `cp` to
  `internal/ui/embedded/export/export.js` (Go `//go:embed`).
- **`web/vite.config.export.js` currently has NO svelte plugin.** It must gain
  `plugins: [svelte()]` in Phase 2, or the export build cannot compile
  `.svelte` files. (Set the plugin's `emitCss: false` if it ever complains;
  today components have no `<style>` blocks — all CSS lives in
  `internal/ui/embedded/styles/session.css` — so no CSS chunk is produced.)
- Go embed location does **not** move. Only the *content* of `export.js`
  changes (now Svelte-compiled). No `export.go` change beyond the guard test.

---

## 2. Target architecture

### One reactive model per page (Svelte context)

`session/data/session-data.svelte.js` exports a `SessionDataModel` class:

```js
export class SessionDataModel {
  entries  = $state([]);
  header   = $state(null);
  labelMap = $state(new Map());

  byId        = $derived(buildById(this.entries));
  toolCallMap = $derived(buildToolCallMap(this.entries));
  tree        = $derived(buildTree(this.entries, this.labelMap));
  nodeMap     = $derived(buildTreeNodeMap(this.tree));
  flatNodes   = $derived(flattenTree(this.tree));

  // view state
  currentLeafId   = $state(null);
  currentTargetId = $state(null);
  filterMode      = $state('default');
  searchQuery     = $state('');

  constructor(payload) { /* loadSessionData → set $state */ }
  applyLiveUpdate(payload) { this.entries = payload.entries; /* … */ }  // live only
}
```

Create it once in the page (`SessionPage.svelte` / `ExportApp.svelte`), provide
via `setContext`, read via `getContext` in children. **Live reload becomes
`model.applyLiveUpdate(...)`** — no manual DOM diffing (`live-renderer.js`
disappears).

### Three component tiers (enforce the layering)

1. **Pure `.svelte.js` (no DOM, no `$state` needed):** `session-format`,
   `markdown`, `session-tree`, `session-filter`, `artifact-registry`,
   `artifact-filter`, `annotation-range`. Plain exported functions; trivial unit
   tests.
2. **Shared presentational components (live + export — MUST NOT import any
   live-only module):** `SessionTree`/`TreeNode`, `SessionContent`/`SessionEntry`,
   `SessionHeader`. State injected via props/context only.
3. **Live-only components:** everything that touches SSE/`fetch`/clipboard/etc.
   — `ChatComposer`, `LiveReload`, `RightSidebar`, `ArtifactPanel`,
   `AnnotationLayer`, all modals/popups, page orchestrators.

**Hard rule (CI-enforced in §6):** a tier-2 component importing a tier-3 module
is a bug — it would leak live-only code into the export bundle.

---

## 3. Phase plan (each phase ends green; ship per-phase PRs)

> No PoC gate. But still incremental: every phase must leave
> `make check` + `npm run test` + `make e2e` green and a runnable binary.

### Phase 1 — Reactive foundation (additive, zero deletions)

- Add testing deps + vitest setup (§1).
- Create the pure `.svelte.js` modules (rename/copy logic; keep old `.js` for
  now so nothing breaks): `session-format`, `markdown`, `session-tree`,
  `session-filter`, `session-data` (pure parts) and the `SessionDataModel` /
  filter state.
- Port **their** unit tests to plain vitest (pure functions — no DOM).
- Introduce the Svelte context provider scaffold in `SessionPage.svelte`
  (model created, provided, not yet consumed by children).
- **Exit:** green CI. Nothing visually changed.

### Phase 2 — Shared rendering components (live + export switch together) ⚠️ riskiest

This is the phase that touches the export invariant. Do it as one PR.

- Build tier-2 components: `SessionTree.svelte` + `TreeNode.svelte` (recursive),
  `SessionContent.svelte` + `SessionEntry.svelte`, expand `SessionHeader.svelte`.
  They read the model via context; **no live-only imports**.
- **Live:** `session.js` mounts these instead of calling `tree-renderer` /
  `session-entry-renderer` / `session-header-renderer` / `session-navigation`.
- **Export:** add `plugins: [svelte()]` to `web/vite.config.export.js`; create
  `web/src/export/ExportApp.svelte`; rewrite `export-entry.js` to
  `mount(ExportApp, { target, props })` (still exports `runExportApp` + the
  bottom auto-run guard). Imports tier-1/tier-2 only.
- Harden the guard test (§6) and run the export build.
- **Delete:** `render/session-entry-renderer.js`,
  `render/session-header-renderer.js`, `navigation/session-navigation.js`,
  `tree/tree-renderer.js`, and the DI bootstrap body of `export-entry.js`.
- **Exit:** green CI **including** `npm run build:export`, the hardened guard
  test, and `make e2e` (export-preview e2e specifically — see
  `docs/dev/e2e-testing.md`).

### Phase 3 — Live-only session components

- `ChatComposer.svelte` (absorbs `chat-composer-runner`, `chat-selectors`,
  `chat-api`, `git-footer`, `done-notifier`) + children `ModelSelector`,
  `ThinkingSelector`, `SlashPalette`, `MentionAutocomplete`.
- `LiveReload.svelte` (SSE in `onMount`, calls `model.applyLiveUpdate`) +
  `LiveStats`, `ChatPreview`, `ResumeButton`, `NewSessionButton`. **Delete**
  `live-renderer.js` and `live-scroll.js` (replace with `scrollIntoView` +
  CSS `scroll-behavior`).
- `RightSidebar.svelte` (absorbs `ui/right-sidebar`, `ui/sidebar`,
  `ui/search-filters`, `ui/session-ui-runner`, `ui/toggle-state`,
  `ui/load-earlier`), `ArtifactPanel.svelte`, `AnnotationLayer.svelte`.
- Modals/popups → components: `BtwPopup`, `CommandMenu`, `ForkModal`,
  `FullScreenSheet`, `ModelUsageModal`, `ShortcutsModal`, `ShareOverlay`,
  `LabelModal`, `ImageModal`, `CatGatekeeper`.
- Expand `SessionPage.svelte` to orchestrate; **delete `session/session.js`**.
- **Exit:** green CI + e2e (chat stub, artifacts, annotations, btw, mobile).

### Phase 4 — Index + Settings pages

- Index: `SessionsList.svelte`, `SessionCard.svelte`, wire existing
  `NewSessionModal`/`ProjectsModal`/`HomeMenu`/`IndexHeader` shells; expand
  `SessionsPage.svelte`. `shared/session-list-palette.js` →
  `CommandPalette.svelte`. **Delete** `index/index.js`,
  `index/sessions-page.js`, `index/session-card.js`.
- Settings: give each `components/settings/*Settings.svelte` local `$state` +
  `onchange → writeSetting()`; **delete `settings/settings.js`**.
  `cat-gatekeeper/cat-settings.js` folds into `CatGatekeeperSettings.svelte`.
- `shared/version.js` update-checker UI → component(s) used by AboutSettings /
  CommandMenu.
- **Exit:** green CI + e2e (index, search, new-session, settings, projects).

### Phase 5 — Test rewrite completion + cleanup

- Finish porting every remaining `.test.js` to `@testing-library/svelte`
  (`render`, `screen.getByRole/Text`, `fireEvent`/`user-event`).
- Remove all `documentImpl` / `windowImpl` DI parameters now that nothing uses
  them.
- `npm run knip` → delete any module it flags from §8; confirm none survive.
- Docs: update `AGENTS.md` (frontend tables + coding standards), `docs/dev/
  templates-vs-web.md`, `docs/architecture/{system-overview,frontend}.md` to
  describe pure-Svelte live+export.
- **Exit:** all success criteria in "Done when" met.

---

## 4. Per-phase definition of done (verification commands)

Run from repo root unless noted:

```bash
(cd web && npm run test)     # vitest (ported + new component tests)
make check                   # go test ./... + build + vet  (also builds export.js)
make e2e                     # Playwright across desktop/mobile/iPad
(cd web && npm run knip)     # dead-code check (esp. Phases 2–5)
```

A phase PR may not merge unless all four are green (knip advisory until Phase 5,
mandatory at Phase 5).

---

## 5. Module → target map (complete; nothing omitted)

🔄 = becomes `.svelte.js` (pure)  ·  ✨ = becomes Svelte component  ·
✅ = stays as-is (framework-agnostic util)  ·  🗑️ = deleted after absorption

### Shared (live + export)
| Module | Target |
|---|---|
| `render/session-format.js` | 🔄 `session-format.svelte.js` |
| `render/markdown.js` | 🔄 `markdown.svelte.js` |
| `tree/session-tree.js` | 🔄 `session-tree.svelte.js` |
| `tree/session-filter.js` | 🔄 `session-filter.svelte.js` |
| `data/session-data.js` | 🔄 `session-data.svelte.js` (+ `SessionDataModel`) |
| `render/session-entry-renderer.js` | ✨ `SessionContent` + `SessionEntry` |
| `render/session-header-renderer.js` | ✨ `SessionHeader` (expand) |
| `tree/tree-renderer.js` | ✨ `SessionTree` + `TreeNode` |
| `navigation/session-navigation.js` | ✨ logic in `SessionPage` / nav helper |
| `ui/sidebar.js`, `ui/search-filters.js`, `ui/toggle-state.js`, `ui/session-ui-runner.js` | ✨ absorbed into `SessionTree`/`RightSidebar` |
| `ui/image-modal.js` | ✨ `ImageModal` (shared) |
| `shared/keyboard-nav.js` | ✅ keep as util/action |

### Live-only — session viewer
| Module(s) | Target |
|---|---|
| `chat/chat-composer-runner.js` (1121), `chat/chat-selectors.js`, `chat/chat-api.js`, `chat/git-footer.js`, `chat/done-notifier.js`, `chat/git-api.js` | ✨ `ChatComposer` (+ helpers) |
| `chat/model-selector.js` | ✨ `ModelSelector` |
| `chat/thinking-selector.js` | ✨ `ThinkingSelector` |
| `chat/slash-command.js` | ✨ `SlashPalette` |
| `chat/mention-autocomplete.js` | ✨ `MentionAutocomplete` |
| `live/live-reload-runner.js`, `live/live-events.js`, `live/live-entries.js` | ✨ `LiveReload` |
| `live/live-renderer.js`, `live/live-scroll.js` | 🗑️ (reactive model + `scrollIntoView`) |
| `live/live-stats.js`, `live/chat-preview.js`, `live/resume-button.js`, `live/new-session-button.js` | ✨ `LiveStats` / `ChatPreview` / `ResumeButton` / `NewSessionButton` |
| `live/btw-popup.js` (621) | ✨ `BtwPopup` (see `docs/sequence-flows/btw.md`) |
| `live/command-menu.js` | ✨ `CommandMenu` (expand shell) |
| `live/fork-modal.js` | ✨ `ForkModal` |
| `live/full-screen-sheet.js` | ✨ `FullScreenSheet` |
| `live/model-usage-modal.js` | ✨ `ModelUsageModal` |
| `live/shortcuts-modal.js` | ✨ `ShortcutsModal` |
| `live/share-overlay.js` | ✨ `ShareOverlay` (expand `ShareDialog` shell) |
| `ui/right-sidebar.js`, `ui/load-earlier.js`, `ui/label-modal.js` | ✨ `RightSidebar` / `LoadEarlier` / `LabelModal` |
| `artifacts/artifact-registry.js`, `artifacts/artifact-filter.js` | 🔄 pure `.svelte.js` |
| `artifacts/artifact-panel.js` | ✨ `ArtifactPanel` |
| `annotations/annotation-range.js` | 🔄 pure `.svelte.js` |
| `annotations/annotation-layer.js`, `annotations/annotation-api.js` | ✨ `AnnotationLayer` |
| `cat-gatekeeper/cat-gatekeeper.js` | ✨ `CatGatekeeper` |
| `session/session.js` (692) | 🗑️ → `SessionPage.svelte` |

### Live-only — index & settings
| Module(s) | Target |
|---|---|
| `index/index.js`, `index/sessions-page.js`, `index/session-card.js` | ✨ `SessionsPage` + `SessionsList` + `SessionCard` |
| `shared/session-list-palette.js` | ✨ `CommandPalette` (expand shell) |
| `settings/settings.js` | 🗑️ → per-section settings components |
| `cat-gatekeeper/cat-settings.js` | ✨ folds into `CatGatekeeperSettings` |
| `shared/version.js` | ✨ update-checker UI → component; keep any pure helpers |

### Stays (framework-agnostic)
`shared/{i18n,icons,theme,fonts,api,storage,escape,settings-store,status-events}.js`,
`shared/locales/*`, `routes/session-page-data.js` (data fetch helper).

---

## 6. Export self-containment (the load-bearing constraint)

`internal/ui/templates_embed_test.go :: TestExportBundleIsSelfContained` today
greps the built `export.js` for `EventSource`, `runLiveReload`,
`live-reload-runner`, `chatComposerRunner`. **Harden it in Phase 2** to also
forbid:

```
EventSource   WebSocket   "fetch("   live-reload   ChatComposer
ArtifactPanel AnnotationLayer  applyLiveUpdate   /api/
```

(Match symbols that uniquely identify tier-3 modules.) Also keep the existing
empty-bundle check. If a forbidden symbol appears, a tier-2 component imported a
tier-3 module — fix the import, don't loosen the test.

Belt-and-suspenders: in `vite.config.export.js`, optionally mark live-only entry
modules `external` so a stray import fails the build loudly instead of bloating
the bundle.

**Why export is safe to make reactive:** it mounts once and never updates, so
`$state`/`$derived` simply compute once. The Svelte 5 runtime (~10 KB gz) is the
only added weight and is acceptable for a Gist. Do **not** wire SSE/fetch into
`ExportApp` — those DOM hosts aren't emitted server-side when `IsLive` is false.

---

## 7. Testing rewrite (full)

- Pattern: `import { render, screen } from '@testing-library/svelte'` +
  `import userEvent from '@testing-library/user-event'`.
- Pure `.svelte.js`: plain vitest unit tests (no DOM) — do these first per
  module, they're cheap and lock behaviour before the component wrap.
- Components: `render(Component, { props })` →
  `screen.getByRole/getByText` → `await user.click(...)` → assert.
- Delete the `documentImpl`/`windowImpl` fakes as each module's last DI consumer
  is removed (Phase 5 sweep).
- Keep coverage at least at parity per module; the existing `.test.js` files are
  the behavioural spec — port their cases, don't drop them.

---

## 8. Deletion checklist (verify with `knip` in Phase 5)

```
session/session.js
session/render/session-entry-renderer.js
session/render/session-header-renderer.js
session/tree/tree-renderer.js
session/navigation/session-navigation.js
session/ui/{sidebar,search-filters,session-ui-runner,toggle-state,right-sidebar,load-earlier,label-modal,image-modal}.js
session/chat/{chat-composer-runner,chat-selectors,chat-api,git-footer,git-api,done-notifier,model-selector,thinking-selector,slash-command,mention-autocomplete}.js
session/live/{live-reload-runner,live-events,live-entries,live-renderer,live-scroll,live-stats,chat-preview,resume-button,new-session-button,btw-popup,command-menu,fork-modal,full-screen-sheet,model-usage-modal,shortcuts-modal,share-overlay}.js
session/artifacts/artifact-panel.js
session/annotations/{annotation-layer,annotation-api}.js
session/cat-gatekeeper/{cat-gatekeeper,cat-settings}.js
index/{index,sessions-page,session-card}.js
settings/settings.js
shared/session-list-palette.js
```

(`image-modal`/`keyboard-nav` stay if reused as shared utils; `version.js` keep
any pure helpers.)

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Live-only code leaks into export | Hardened guard test (§6) + optional `external` in export config + tier layering rule |
| Export build can't compile `.svelte` | Add `plugins: [svelte()]` to `vite.config.export.js` (Phase 2, first thing) |
| Test rewrite stalls the migration | Port pure-module tests first (cheap); component tests phase-by-phase; never merge a phase with red tests |
| Tree perf regression on huge sessions | Profile `SessionTree` at 10k+ entries; add a virtualized list if needed (keep `flattenTree`) |
| Half-migrated `session.js` breaks live | session.js deleted only at end of Phase 3, after all its children exist |
| Scope creep (btw/cat-gatekeeper/modals forgotten) | §5/§8 enumerate every module; knip is the backstop |

---

## 10. Working conventions for the executor

- **Branches:** descriptive, e.g. `svelte/phase-2-shared-rendering` (no
  `claude/…` prefix, no random suffixes).
- **Commits:** authored as `Set Kyar Wa Lar (Universe) <setkyar16@gmail.com>`,
  not `Claude`. Follow `AGENTS.md` coding standards (Lucide icons via
  `icons.js`, i18n via `t()` for any new user-facing string, CSS stays in
  `session.css`).
- **PRs:** one per phase; do not open a PR unless asked, but keep each phase a
  clean, separately-mergeable commit.
- **Do not** re-litigate the §0 locked decisions.

---

## 11. Progress log

Branch: `svelte/phase-1-reactive-foundation` (off `main`).

| Status | Item |
|---|---|
| ✅ done | **Phase 1** — `SessionDataModel` (`session-data.svelte.js`, `$state`/`$derived`, reuses pure helpers; `load`/`applyLiveUpdate`); `session-context.js`; wired (provided, hydrated, **not yet consumed**) into `SessionPage.svelte`; `@testing-library/svelte` + jest-dom + `vitest.setup.js`. Unit + smoke tests. |
| ✅ done | **Phase 2 prep** — `@sveltejs/vite-plugin-svelte` added to `vite.config.export.js` (`emitCss:false`); `TestExportBundleIsSelfContained` hardened (forbids `WebSocket`, `live-reload`, `ChatComposer`, `ArtifactPanel`, `AnnotationLayer`, `applyLiveUpdate`). |
| ✅ done | **Phase 2 (tree, staged)** — `TreeNode.svelte` + `SessionTreeNodes.svelte`: reactive, live-safe, markup-parity replacements for `tree-renderer.js`, with component tests. **Staged, not wired** into the live shell / export entry. |
| ✅ available | **e2e now runs here.** `cd e2e && npm ci && npx playwright install chromium` works (chromium downloads, headless launches without `--with-deps`). **Baseline green: 54 passed / 2 skipped** on `--project="Desktop Chrome"` against the built binary. So cut-overs ARE verifiable (at least Desktop Chrome; other browsers untried). |
| ✅ DONE + verified | **Phase 2 tree cut-over (live + export) complete.** The reactive `SessionDataModel` is the single source of truth (shared via `window.__piSessionDataModel` + Svelte context); `<SessionTreeNodes>` renders the sidebar in BOTH the live app (`SessionTree.svelte`) and the static export (`export-entry.js` mounts it). `session.js`/`export-entry.js` push view state into the model; live reload reconciles via reactive in-place mutation (no DOM diff). **`tree-renderer.js` + test DELETED.** Guard test updated. **Verified: web 537 + knip clean + `go test ./internal/ui` + full e2e (Desktop Chrome) 53/2.** Export bundle +15KB gzip (Svelte runtime). The note below is now resolved — the model owns the tree/nav/filter state. |
| ✅ DONE + verified | **Phase 2 header cut-over (live + export) complete.** `session-stats.js` (pure stats/token helpers) + `SessionInfoHeader.svelte` (reactive header card, local expand state, keeps data-action toggle buttons). Navigator no longer renders the header; `attachHeaderHandlers()` called once post-setup. **`session-header-renderer.js` + test DELETED.** Go source-guard tests repointed. **Verified: web 543 + knip clean + `go test ./internal/ui` + full e2e (Desktop Chrome) 53/2.** |
| ⚠️ entangled — do with Phase 3 | **Phase 2 remainder: `session-entry-renderer.js` (638 LOC) → `<SessionContent>`/`<SessionEntry>` is NOT isolatable.** Investigated: `#messages` is shared by THREE imperative systems — (1) the navigator's full-path render, (2) live-reload's incremental `appendEntry`/`upsertEntry` + seen-set (`live-entries.js`/`live-events.js`/`live-reload-runner.js`), and (3) the chat composer's optimistic preview (`chat-preview.js` inserts `#chat-pending-user` + `#chat-preview-stream` directly into `#messages`). A reactive `{#each model.activePath}` owning `#messages` children would reconcile away the imperatively-inserted preview nodes and fight incremental append. **So the message pane must be migrated together with live-reload + chat-preview (Phase 3), not alone.** Stopped here rather than break the core conversation/live/chat view. |

### Recommended combined step (Phase 2-entry + Phase 3-content)

Do these as one carefully-sequenced, e2e-gated effort:

1. Add `activePath = $derived(getPath(currentLeafId, byId))` to `SessionDataModel`.
2. `<SessionContent>`: render `{#each model.activePath as entry (entry.id)}<SessionEntry {entry}/>{/each}`. For the first pass, `<SessionEntry>` may wrap the existing `renderEntry(entry)` output via `{@html …}` to avoid rewriting 638 LOC at once; decompose into real sub-components afterwards. A post-render `$effect` re-applies toggle state + lazy highlight + button wiring (copy/fork/label) per entry — or move those into `<SessionEntry>` handlers.
3. **Relocate the optimistic chat preview OUT of the reactive list:** give `#chat-pending-user`/`#chat-preview-stream` their own container that is a sibling after the `{#each}` (still inside the scroller), so Svelte never reconciles them. Update `chat-preview.js` to target it.
4. **Replace incremental append with reactivity:** live-reload mutates `model.entries` (already reactive); `activePath` recomputes and `{#each}` adds new entries. Retire `live-entries.js` append/upsert/seen; keep the new-entry highlight + auto-scroll as a `$effect`. This is the Phase 3 live-reload migration.
5. Move scroll/highlight (`scrollMode` target/bottom) into a `$effect` keyed on `currentTargetId` / entries length.
6. Delete `session-entry-renderer.js` only once live + export render via `<SessionContent>`; verify `npm run test` + `npm run build` + guard + full e2e (chat, live-reload, annotations, artifacts, session-view, share).

#### Sub-step A — DONE (committed, staged, not wired)

`SessionDataModel.activePath`, `<SessionEntry>` ({@html renderEntry}), `<SessionContent>`
({#each model.activePath} in `#messages-list` + `afterRender` hook), all unit-tested.
Web 550 green, knip clean.

#### Sub-step B — wiring design (the high-risk cut-over)

Findings that shape it (verified by reading the code):

- **DOM stability vs annotations:** `session.js` `syncDataModelEntries` replaces
  entries with NEW objects each reload, so a keyed `{#each}` sees "same id, new
  object" and re-runs `{@html renderEntry(entry)}`. That's safe ONLY because
  `renderEntry` is deterministic → identical string → Svelte's `{@html}` skips the
  DOM write → annotation offset anchors + scroll survive. Verify this holds (no
  per-render nonces/timestamps-of-now in `renderEntry`); if not, memoize html by an
  entry content-signature. CPU: re-runs `renderEntry` for the whole path per reload
  — fine for normal sessions, optimize for huge ones later.
- **Buttons:** bind ONE delegated `click` handler on `#messages` (copy/fork/label
  via `e.target.closest(...)`) instead of per-node binding — avoids double-binding
  across reactive re-renders.
- **chat-preview coexistence:** `<SessionContent>` renders into `#messages-list`;
  `chat-preview.js` keeps `appendChild`-ing `#chat-pending-user`/`#chat-preview-stream`
  to `#messages` (siblings AFTER `#messages-list`), so Svelte never reconciles them.
  (CSS check done: no `#messages > …` direct-child selectors exist.)

**Scope reality (confirmed by reading the code):** retiring append is not a small
step — it migrates the WHOLE incremental live-update subsystem at once:
`live-reload-runner.js` + `live-events.js` + `live-entries.js` + `live-renderer.js`
(`appendEntry`/`upsertEntry`/`refreshEntriesAffectedByToolResult`) **and**
`chat-preview.js`, on the live-chat path. Treat sub-step B as the Phase-3 live
migration, executed with full budget + the complete e2e suite — not a tail-end
change. (`renderEntry` determinism precondition: CONFIRMED — no `Date.now`/random.)

Wiring steps: SessionPage holds a `SessionContentRuntime` ($state `renderEntry` +
`afterRender`), exposes it on `window.__piContentRuntime`, renders
`<SessionContent renderEntry={rt.renderEntry} afterRender={rt.afterRender}/>` inside
`#messages` (drop `firstMessageStub`). `session.js` sets `rt.renderEntry =
entryRenderer.renderEntry` and `rt.afterRender = (c)=>{applyToggleStateToNode(c);
applyLazyHighlighting(doc);}`, binds the delegated button handler once, and gates the
navigator to **onNavigate + scroll only** (drop the `#messages` fragment build,
`renderEntryToNode`/`entryCache`, button wiring). Retire `live-entries.js`
append/upsert/seen (live reload now flows through the reactive model); keep the
new-entry highlight + auto-scroll as effects. Mirror in `export-entry.js` (mount
`<SessionContent>` into `#messages`). Then delete `session-entry-renderer.js`.
Verify full e2e (esp. live-reload, chat streaming, annotations anchoring).

#### Sub-step B — DONE + verified

The message pane is now rendered by the reactive `<SessionContent>` in **both** the
live app and the static export; the imperative `#messages` build is gone.

- **Live (`session.js` / `SessionPage.svelte`):** `SessionPage` owns a `$state`
  content runtime exposed on `window.__piContentRuntime`; `runSessionApp` assigns
  `renderEntry` (= the entry renderer) and `afterRender` (re-applies toggle state +
  lazy highlight). `<SessionContent model={sessionModel} …>` renders inside
  `#messages` (the `firstMessageStub` LCP placeholder was dropped). Copy/fork/label
  are now ONE delegated `click` listener on `#messages`.
- **Navigator gutted to nav-state + scroll only.** `session-navigation.js` no longer
  builds DOM, caches nodes (`entryCache`/`renderEntryToNode` removed), or wires
  per-entry buttons — it sets the model's active leaf/target (→ reactive
  `activePath`) and scrolls after the Svelte flush.
- **Live reload no longer patches the DOM.** `handleSessionReload` gained a reactive
  mode (no `appendEntry`/`upsertEntry`): it reconciles purely via the model
  (`onSessionDataReload` → `syncDataModelEntries`), tracks new ids for
  follow/scroll, and flags them via `onNewEntries` so `live-reload-runner` applies
  the new-entry highlight. `live-entries.js` is retained (still unit-tested + the
  imperative path is kept for the legacy `handleSessionReload` branch) but is no
  longer wired into the live content path — slated for the Phase-5 knip sweep.
- **Export (`export-entry.js`):** mounts `<SessionContent>` into `#messages` bound to
  the reactive `treeModel`; navigator simplified the same way. Guard test still
  green (SessionContent/SessionEntry import no live-only modules).
- **`session-entry-renderer.js` is KEPT** (not deleted): `<SessionEntry>` still wraps
  its `renderEntry()` output via `{@html}` for this pass. Its decomposition into real
  sub-components (and the renderer's deletion) is a later step.
- **Critical fix uncovered by load-earlier e2e:** `byId`/`toolCallMap`/`labelMap`
  switched from `$state(new Map())` to **`SvelteMap`**. A plain `$state` Map's
  `.set`/`.clear` are NOT reactive (only reassignment is), so a derived reading
  `byId` (e.g. `activePath`) failed to recompute when entries were prepended without
  the active leaf changing (load-earlier). `SvelteMap` makes in-place mutation
  reactive while keeping the stable identity that captured references need.
- **CSS:** `#messages-list` is `display: contents` so entries keep `#messages`'
  flex/gap layout and the optimistic chat-preview siblings stay correctly spaced.
- **Go source-guard `TestNavigationReappliesCurrentToggleStateAfterRenderingMessages`**
  repointed from the old navigator to `<SessionContent>`'s `afterRender` hook +
  `session.js`.
- **Verified:** web 554 green · `npm run build` (live + export) · `npm run knip`
  clean · `go test ./...` green except the pre-existing sandbox-only
  `internal/git TestDescribeDefaultBranch` (commit-signing) · `go vet` + binary build
  · full **Desktop Chrome** e2e **53 passed / 2 skipped** (load-earlier's documented
  contention flake passes on its configured retry). Other browsers untried (matching
  the existing baseline).

### Phase 3 — live-only components (IN PROGRESS)

Sequencing note: the headline modules (`ChatComposer`, `LiveReload`, `RightSidebar`)
are tightly coupled to `session.js` — they need `navigateTo`, the shared model, and
a strict init ordering (chat must initialise after live-reload). Per the plan those
can only be fully extracted as `session.js` is dismantled at the END of Phase 3, so
Phase 3 starts with the genuinely **isolatable** components (no session-data /
`navigateTo` coupling), each a clean, deletable, e2e-green increment, and works
inward toward the coupled chat/live core.

| Status | Item |
|---|---|
| ✅ DONE + verified | **`ImageModal.svelte`** (shared, live + export). Click-to-zoom overlay absorbed from `ui/image-modal.js`: reactive `open`/`src`/`alt`, document-level delegated listener for `.message-image` / `.pi-chat-attachment-preview`, Escape/backdrop close. Live renders `<ImageModal/>` in `SessionPage`; export mounts it into `#image-modal-host` (static `#image-modal` markup removed from `session.html`). **`ui/image-modal.js` + test DELETED**, tests ported to `ImageModal.test.js`. Verified: web 553 + knip clean + `go test ./internal/ui` + Desktop-Chrome e2e 53/2. |
| ✅ DONE + verified | **Resume ("Terminal") + New Session buttons → `SessionHeader.svelte`.** Behavior absorbed from `live/resume-button.js` + `live/new-session-button.js` into the component that already owns the hidden command-relay buttons (`onMount` wires `#resume-btn`/`#new-btn` by id, so the many `getElementById(...).click()` callers keep working unchanged). `SessionPage` passes `cwd`/`sessionId`. `runLiveReload` lost its `resumeButton`/`newSessionButton`/`cwd` deps + setup calls; `session.js` lost the imports. **4 files DELETED** (both modules + tests). Go resume source-guards (`export_html_test.go`) repointed to `SessionHeader.svelte` (`document.*`/`navigator.*`). Verified: web 544 + knip clean + `go test ./internal/ui` + Desktop-Chrome e2e 53/2. |

| ✅ DONE + verified | **`FullScreenSheet.svelte` + `ShortcutsModal.svelte`** (sheet-infra chunk, part 1/4). Svelte port of `live/full-screen-sheet.js` (`showSheet`): same markup/classes/behavior — ref-counted scroll-lock, focus trap, Escape/backdrop close (backdrop listener attached imperatively to match the codebase's delegated convention + avoid a11y lint), mobile synthetic-history back-gesture close — driven by a single bindable `open`. `ShortcutsModal` ports `live/shortcuts-modal.js` with reactive search. Triggers bridged via `window.__piOpenShortcuts` (set in `SessionPage`, called from `session.js` Cmd+/ + `#shortcuts-help-btn`). **`live/shortcuts-modal.js` DELETED**; component tests added. `full-screen-sheet.js` retained for the 3 remaining consumers. Verified: web 547 + knip clean + no a11y build warnings + `go test ./internal/ui` + Desktop-Chrome e2e 54/2. |

| ✅ DONE + verified | **`ModelUsageModal.svelte`** (sheet-infra 2/4). Svelte port of `live/model-usage-modal.js`: pure stat/cost/breakdown helpers + reactive markup over `<FullScreenSheet>`, computed from the shared model via context (no `escapeHtml` needed — Svelte auto-escapes; `formatTokens` from `session-stats`). Trigger bridged via `window.__piOpenModelUsage` (command-menu's `model-usage` action). Also added `backdropClass`/`panelClass`/`bodyClass` props to `FullScreenSheet` (the former `showSheet` consumers tag the sheet for CSS) — **fixes a missed `shortcuts-sheet-*` styling regression** from 1/4 — and a destroy-time listener/scroll-lock cleanup. **`live/model-usage-modal.js` + test DELETED** (ported to `ModelUsageModal.test.js`); `command-menu.test.js` updated. Verified: web 545 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 53/2. |

| ✅ DONE + verified | **`ForkModal.svelte`** (sheet-infra 3/4). Svelte port of `live/fork-modal.js`: searchable user-message palette with keyboard nav (↑/↓/Enter), preview pane, and `onSelect(entryId)` fork callback, over `<FullScreenSheet>`. `<script module>` exports `buildUserMessageList` so `SessionPage`'s bridge can do the "no user messages" empty check (returns false → command-menu shows the toast, parity with the old null-sheet). command-menu's `fork` action fetches fresh entries then calls `window.__piOpenForkModal({ entries, onSelect })`. **`live/fork-modal.js` + test DELETED** (ported to `ForkModal.test.js`). Verified: web 546 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 54/2. |

| ✅ DONE + verified | **`CatGatekeeperSettings.svelte` (sheet-infra 4/4) + `full-screen-sheet.js` DELETED.** Moved the `showCatSettings` sheet UI into a reactive component over `<FullScreenSheet>`; the pure storage helpers stay in `cat-settings.js` (now also exports `LIMITS`; no longer imports `showSheet`). The cat-gatekeeper controller's `openSettings()` bridges via `window.__piOpenCatSettings({ controller, onChange })`. With its last consumer gone, **`live/full-screen-sheet.js` + test DELETED** (the `showSheet` util is fully replaced by `<FullScreenSheet>`). `cat-settings.test.js` keeps the pure-helper tests; sheet test ported to `CatGatekeeperSettings.test.js`. Verified: web 530 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 54/2. |

**Sheet-infra chunk COMPLETE** — `FullScreenSheet` + 4 modals are Svelte; 5 modules
deleted (`full-screen-sheet`, `shortcuts-modal`, `model-usage-modal`, `fork-modal`,
and the `showCatSettings` UI).

### Phase 3 — coupled core (IN PROGRESS)

| Status | Item |
|---|---|
| ✅ DONE + verified | **`ShareDialog.svelte`** (self-contained). Absorbed `live/share-overlay.js`: wires the hidden `#share-btn` relay → `POST /share` → reactive overlay showing gist/preview URLs (or error) with clipboard-copy + toast. `runLiveReload` lost its `shareOverlay` dep + the `setupShareButton` block (and the now-unused `escapeHtml` helper); `session.js` lost the import. **`live/share-overlay.js` + test DELETED** (ported to `ShareDialog.test.js`); Go share source-guard repointed to `ShareDialog.svelte`. Verified: web 528 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 54/2. |

| ✅ DONE + verified | **`CommandMenu.svelte`** (self-contained behavior). Absorbed `live/command-menu.js` into the component's `onMount`: open/close (desktop popover + mobile panel), outside-click/Escape close, and the action dispatch (share/new/terminal click hidden relays; tree → `sidebarApi`; model-usage/fork via window bridges; rename/clone via fetch; version/user-docs/diff). The session-list palette is now reached via `window.__piOpenSessionPalette` (set in `session.js`, used by the `list-sessions` action **and** Cmd+K), replacing the `setupCommandMenu._palette` coupling. `session.js` dropped the `setupCommandMenu` import + call. **`live/command-menu.js` + test DELETED** (ported to `CommandMenu.test.js`). Verified: web 528 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 53/2. |

| ✅ DONE + verified | **`LabelModal.svelte`** (RightSidebar-group warm-up; well covered by `labels.spec.ts`). Svelte port of `ui/label-modal.js`: set/clear an entry's tree label, opened via `window.__piOpenLabelModal({ entryId, currentLabel, onSave })` (session.js's delegated label button still owns the save → API + tree refresh). **`ui/label-modal.js` + test DELETED** (ported to `LabelModal.test.js`). Verified: web 528 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 54/2 (labels/annotations/artifacts/session-view all green). |

| ✅ DONE + verified | **`RightSidebar.svelte` chrome.** Absorbed `ui/right-sidebar.js` (`setupRightSidebar` + `setupRightSidebarTabs`: scratchpad load/save with 1s debounce, left-edge resize drag + dblclick reset, tab switching with persistence/restore, expand/collapse, backdrop/close) into `RightSidebar.svelte`'s `onMount`. The component exposes its controls on `window.__piRightSidebar`; `session-ui-runner.js` reads them lazily (its `setupRightSidebar*` calls + `projectPath` dep removed). **`ui/right-sidebar.js` + `right-sidebar-tabs.test.js` DELETED** (ported to `RightSidebar.test.js`). Verified: web 530 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 53/2. |
| ✅ DONE + verified | **`ArtifactPanel.svelte`.** Replaced the imperative innerHTML `artifacts/artifact-panel.js` renderer with a reactive component mounted inside `<RightSidebar>`'s Artifacts pane. `session.js` still owns artifact collection/filter (`refreshArtifacts`) and pushes the visible set through `window.__piArtifactPanel` (also used by the annotation layer for `selectArtifact`/`getArtifact`). The component lazy-loads `highlight.js` and renders markdown previews itself; keeps the `<pre id="artifact-<id>">` annotation anchor + sandboxed iframe preview. **`artifact-panel.js` + test DELETED** (ported to `ArtifactPanel.test.js`, 16 cases). Verified: web 529 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 54/2. |
| ✅ DONE + verified | **`AnnotationLayer.svelte`.** Replaced the imperative innerHTML `annotations/annotation-layer.js` with a reactive component in `<RightSidebar>`'s Notes pane. Notes list / comment popover / note modal render declaratively (delegated click listeners attached imperatively for a11y); selection detection, highlight (re)application via `MutationObserver`, and the annotations API stay imperative. `session.js` supplies runtime deps (`api`/`scopes`/`composerEl`/`countEl`/callbacks/`resolveArtifact`) via `window.__piAnnotationLayer.init(cfg)`; `setAnnotations`/`reapply` still flow from live reload + `pi-session-reload`. The popover + modal **relocate to `<body>`** in `onMount` so their fixed positioning stays viewport-relative (the right sidebar uses transforms). **`annotation-layer.js` + test DELETED** (ported to `AnnotationLayer.test.js`, 13 cases). Verified: web 529 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 54/2. |

**RightSidebar group COMPLETE** — `RightSidebar` chrome + `ArtifactPanel` +
`AnnotationLayer` are Svelte; 4 modules deleted (`right-sidebar`,
`artifact-panel`, `annotation-layer`, and the right-sidebar bits of
`session-ui-runner`). `annotation-api.js` (pure fetch wrapper) and
`artifact-{registry,filter}.js` (pure) stay.

| ✅ DONE + verified | **navigateTo + view-state ownership → model/SessionPage (prep).** `SessionPage` now builds the session navigator from the reactive model and exposes `navigateTo` on `window` (+ `__piSessionNavigator`) **before** the child components mount, so the tree, chat composer, and live reload share one instance. `currentLeafId`/`currentTargetId`/`filterMode`/`searchQuery` live solely on `SessionDataModel`; `session.js` dropped its mirrored locals, its own `createSessionNavigator` call, `syncTreeRendererState`, and `__piFilterState` (dead). `search-filters` callbacks write the model directly; an init guard seeds `currentLeafId/currentTargetId` for the plain fallback model. Pure refactor. Verified: web 529 + knip clean + `go test ./internal/ui` + Desktop-Chrome e2e 54/2. |
| ✅ DONE + verified | **`ChatComposer` + `LiveReload` → components.** `ChatComposer.svelte` self-inits the chat runner (`runChatComposer`) + git footer (`setupGitFooter`) in `onMount`; new **`LiveReload.svelte`** (markup-less) self-inits the SSE runner (`runLiveReload`, `reactiveContent:true`) in `onMount`. Both read the shared model + `target.navigateTo` from `window`. `session.js` no longer wires chat/live — it just exposes model reconciliation on `window.__piReconcileEntries` (also used by load-earlier) for `<LiveReload>`'s `onSessionDataReload`, and dropped all chat/live/selector imports + the `__PI_TEST_*` hook calls (relocated to the components). `<LiveReload>` mounts before `<ChatComposer>` (SessionPage markup order) so the optimistic `pi-chat-message-sent` listener is attached before the user can send. The chat/live **runner modules stay** as component-owned implementation detail (their own tests still pass); full inlining/deletion is the later cleanup. `session.test.js` updated (reconcile path asserted via `__piReconcileEntries`; the obsolete session.js ordering test removed). Verified: web 528 + knip clean + no a11y warnings + export guard green (`go test ./internal/ui`) + Desktop-Chrome e2e 54/2. |

| ✅ DONE + verified | **e2e coverage added BEFORE converting btw + cat** (plan requirement, since neither had any). `e2e/tests/btw.spec.ts`: open/close from the git bar with empty state, and the optimistic user bubble + running state on send (the worker round-trip is covered by chat.spec; the btw session file lands in a per-cwd subdir the e2e fsnotify watcher races). `e2e/tests/cat.spec.ts`: skip-to-break shows the enforced break overlay with a countdown, enabling the gatekeeper **page-locally** via a `page.route` settings stub so the shared server store (and the rest of the suite) stays untouched. Pin the selectors the components must preserve. Verified green against the imperative code first. |
| ✅ DONE + verified | **`CatGatekeeper.svelte`.** Split the focus/break + bedtime companion: `cat-gatekeeper.js` keeps the DI-testable timer/phase logic but no longer builds the overlay — it calls an injected `view` (`showBreak`/`setBreakTimer`/`showSleep`/`hide`) and an injected `isActive`. The overlay is now `CatGatekeeper.svelte` (declarative, relocated to `<body>`; blocks input while shown, plays the cat video, exposes the controller on `window.__piCatGatekeeper`). `cat-settings.js` (pure storage) stays. `session.js` dropped `setupCatGatekeeper`. Unit test reworked to assert the controller's view calls + state. Verified: web 528 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e (cat.spec + full) 57/2. |
| ✅ DONE + verified | **`BtwPopup.svelte`.** Replaced the imperative innerHTML `live/btw-popup.js` (621) with `BtwPopup.svelte`: the transcript (markdown + tool chips + optimistic/streaming/working bubbles + empty state) renders declaratively; drag, resize, per-session + per-parent SSE, status polling, submit/cancel stay imperative. It wires its `#pi-btw-button` trigger (in `<ChatComposer>`) by id and relocates the window to `<body>` for fixed positioning. `openWindow` clears `hidden` synchronously before `placeInitial` measures, so it isn't positioned off-screen during Svelte's async flush (caught by e2e). `session.js` dropped `setupBtwPopup`; SessionPage renders `<BtwPopup cwd parentId>`. **`btw-popup.js` + test DELETED** (ported to `BtwPopup.test.js`, 12 cases). Verified: web 528 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e (btw.spec + full) 57/2. |

Coupled core remaining: **`session.js` teardown** — inline or delete the now
component-owned chat/live runner modules per §8 (`chat-composer-runner`,
`chat-selectors`, `chat-api`, selectors, `live-reload-runner`, `live-*`,
`chat-preview`; keep pure helpers) and shrink `session.js` to its remaining
glue (keyboard shortcuts, done-notifier, version, session-list palette,
load-earlier, visual-viewport) — ultimately delete it once empty — then the
docs pass (AGENTS.md, templates-vs-web, system-overview/frontend).

### Phase 3/5 — `session.js` teardown (IN PROGRESS)

Branch `refactor/svelte-session-teardown` (off `main`, which already has the
merged coupled-core work). Shrinking `runSessionApp` block by block, moving each
responsibility into the owning component / the model / `SessionPage`, e2e-green
per increment.

| Status | Item |
|---|---|
| ✅ DONE + verified | **Artifacts collection → `<ArtifactPanel>` (reactive).** The panel reads the shared `SessionDataModel` via context and recomputes the visible artifact set (+ tab count + enabled-state fallback) through a `$derived` feeding an `untrack`'d sync `$effect`, replacing session.js's imperative `refreshArtifacts` + the `window.__piArtifactPanel.setArtifacts` push. The help (?) modal wiring moved into `<RightSidebar>`. `session.js` lost `refreshArtifacts`/`applyArtifactsEnabled`/the artifact-host block + the `collectArtifacts`/`filterArtifacts`/`readArtifactSettings` imports. **Bug caught by e2e:** the first cut put collection in an `$effect` calling `setArtifacts` (which reads/writes `artifacts`/`selectedId` `$state`) → `effect_update_depth_exceeded`; fixed by the `$derived` + `untrack` split. Verified: web 528 + knip clean + no a11y warnings + `go test ./internal/ui` + Desktop-Chrome e2e 56/2 (+1 documented load-earlier retry). |
| ✅ DONE + verified | **Model reconciliation → `SessionDataModel.reconcile()`.** Moved session.js's `syncDataModelEntries`/`replaceMapContents` (live-reload + load-earlier path) onto the model as `reconcile(entries)`: in-place entries splice + lookup-map refills + advance the active leaf to the newest descendant. `session.js` now just delegates (`dataModel.reconcile?.(entries)`), exposed on `window.__piReconcileEntries` for `<LiveReload>` + load-earlier; dropped the `buildSessionLookups`/`buildTree`/`buildTreeNodeMap`/`findNewestLeaf` body imports. `session.test.js` updated to provide the reactive model (mirroring SessionPage); 3 reconcile unit tests added. Verified: web 531 + knip clean + build + `go test ./internal/ui` + go vet + Desktop-Chrome e2e (live-reload/load-earlier/chat green). |
| ✅ DONE + verified | **Page-global glue → `session-globals.js` (called by SessionPage).** Relocated the "tail" of `runSessionApp` — done-notifier, `setupKeyboardNav`, version checker, session-list palette (+ Cmd+K), the global keyboard shortcuts (Cmd+K/B/T/⇧L/⇧N//), the shortcuts/new-session relay buttons, the load-earlier banner, and the mobile visual-viewport/scroll-lock handlers — into `setupSessionGlobals({ windowImpl, documentImpl, model, sessionId, navigateTo })`. It tracks the listeners it adds and returns a disposer that `<SessionPage>` calls on unmount. `window.__piReconcileEntries` now set by `<SessionPage>` (from `model.reconcile`) *before* the child components mount, closing the reload race. `session.js` dropped 6 imports + ~175 lines (now 296). Added `session-globals.test.js` covering the keyboard shortcuts (no e2e for those). Verified: web 538 + knip clean + build (no a11y) + `go test ./internal/ui` + go vet + Desktop-Chrome e2e 56/2 (+1 documented load-earlier retry). |
| ✅ DONE + verified | **`session.js` DELETED — head relocated into `<SessionPage>` + two utils.** The remaining `runSessionApp` head moved to `<SessionPage>`'s `onMount` as a local `startSessionRuntime()`: per-page settings/markdown bootstrap, `setupSessionUi`, the content-runtime wiring, the `__piIsMobileLayout`/`__piCloseSidebar` bridges, `attachHeaderHandlers`, the initial `navigateTo`, and the annotation-layer `init({...})`. Two extracted utils: **`lazy-highlight.js`** (`applyLazyHighlighting`) and **`session-content-runtime.js`** (`wireSessionContentRuntime`: builds the entry renderer + `sessionFormat`, assigns `contentRuntime.renderEntry`/`afterRender`, sets `downloadSessionJson`, and binds the single delegated copy/fork/label handler on `#messages`). **`session/session.js` + `session.test.js` DELETED** (the dead re-exports went with it; reconcile is unit-tested on the model). Go guard `TestNavigationReappliesCurrentToggleStateAfterRenderingMessages` repointed from `session.js` → `session-content-runtime.js`. Verified: web 535 + knip clean + build (no a11y) + `go test ./internal/ui` + go vet + **Desktop-Chrome e2e 57/2 (clean, no flake)**. |

**`session.js` teardown COMPLETE** — the live session runtime is now `<SessionPage>` (orchestration) + `session-globals.js` + `session-content-runtime.js` + `lazy-highlight.js`, all reading the reactive `SessionDataModel`.

### Phase 3 — chat/live runner inlining (COMPLETE)

**Tranche COMPLETE.** Every runner/renderer is absorbed into its component:
`chat-composer-runner` + the four selectors → `<ChatComposer>`; `live-reload-runner`
+ `live-events`/`live-scroll`/`live-stats` → `<LiveReload>`; `git-footer` →
`<GitFooter>`; `session-entry-renderer` → `<SessionEntry>`/`<ToolCall>`/`<ToolOutput>`/
`<AskQuestion>`; `live-renderer`/`live-entries` deleted (reactive model). What's
left under `session/chat/` + `session/live/` is **pure/shared helpers only**:
`chat-api`, `git-api`, `chat-selectors`, `done-notifier`, `chat-preview`. `knip` is
clean.

### Phase 4 — index + settings routes (IN PROGRESS)

| Status | Item |
|---|---|
| ✅ DONE + verified | **Index route (`/`) Svelte cut-over.** Added `SessionsList.svelte` + `SessionCard.svelte` and moved the sessions data helpers/API wrappers into `index/sessions.js`; `SessionsPage.svelte` now owns `/api/sessions`, `/api/new-session`, `/api/projects`, `/api/recent-locations`, `__all__` SSE running-state updates, layout persistence, the web menu, and modal state. `CommandPalette.svelte` absorbed the shared session-list palette behavior and exposes `window.__piOpenSessionPalette` for both the index Cmd+K path and the session `<CommandMenu>` action. **Deleted** `index/{index,sessions-page,session-card}.js` and `shared/session-list-palette.js` (+ old tests); component/pure tests added. Verified: web tests 490 → 483 after deleting obsolete suites, `npm run build`, `npm run knip`, `go test ./internal/ui/...`, `go vet ./...`, `go build -o pi-web ./cmd/pi-web`, Desktop-Chrome e2e **56 passed / 2 skipped / 1 flaky retry passed** (documented load-earlier retry). |
| ✅ DONE + verified | **Settings route (`/settings`) per-section Svelte state.** `SettingsPage.svelte` is now a lightweight orchestrator: it hydrates synced settings once, owns the saved toast, and passes `settings` + `onSave` into section components. `AppearanceSettings`, `LanguageSettings`, `SessionsListSettings`, `SessionTitleSettings`, `ArtifactSettings`, `NotificationSettings`, and `CatGatekeeperSettings` now own their local controls with `$derived`/`$state` + `onchange → writeSetting()` (through `settings-support.js`); font detection, custom languages, notification permission/push registration, done-sound preview, model loading, theme/font application all moved out of the route runtime. **`settings/settings.js` remains deleted.** Verified: web tests 483, `npm run build`, `npm run knip`, `go test ./internal/ui/...`, `go vet ./...`, `go build -o pi-web ./cmd/pi-web`, targeted Desktop-Chrome e2e `settings.spec.ts` + `i18n.spec.ts` **10 passed**. |
| ✅ DONE + verified | **Version update UI → `VersionController.svelte`.** `shared/version.js` is now pure helpers + a tiny bridge (`openVersionModal`/`registerVersionController`, version formatting, changelog rendering, `/api/version` fetch). The DOM/`innerHTML` modal/update-check UI moved into `components/shared/VersionController.svelte`, mounted once by `App.svelte` and used by the index menu, session `<CommandMenu>`, and About settings row. The modal renders declaratively, preserves the inline `Checking…` button state, and keeps the status row hidden during checks. Verified: web tests 481, `npm run build`, `npm run knip`, `go test ./internal/ui/...`, `go vet ./...`, `go build -o pi-web ./cmd/pi-web`, targeted Desktop-Chrome e2e `version.spec.ts` **1 passed**. |
| ✅ DONE + verified | **`LoadEarlier.svelte` + cleanup sweep.** Moved the huge-session "Load earlier" banner out of `session/ui/load-earlier.js` into `components/session/LoadEarlier.svelte`, rendered by `SessionPage` above `#messages` and driven by the reactive `SessionDataModel.reconcile()` path. **Deleted** `session/ui/load-earlier.js` + test; component test added. Also trimmed remaining utility-only `innerHTML` use (`done-notifier` now uses `replaceChildren`, chat-preview builds its structural DOM with elements and only assigns sanitized markdown content). Verified: web tests 477, `npm run build`, `npm run knip`, `go test ./internal/ui/...`, `go vet ./...`, `go build -o pi-web ./cmd/pi-web`, targeted Desktop-Chrome e2e `load-earlier.spec.ts` **1 passed**, then full Desktop-Chrome e2e **57 passed / 2 skipped**. |
| ✅ DONE + verified | **Final `.js` innerHTML cleanup.** Absorbed the streaming chat-preview renderer into `LiveReload.svelte`'s module script; `session/live/chat-preview.js` is now pure spinner config for `LiveReload` + `BtwPopup`. Icon swaps now use `setIconElement()` / `setThemeIconElement()` and `replaceChildren()` instead of `innerHTML`. Remaining non-test `.js` `innerHTML` occurrences are pure/non-view exceptions only: syntax highlighting in `lazy-highlight.js` + export highlighting, and `session-format.escapeHtml()`'s off-DOM escape implementation. Verified: web tests 477, `npm run build`, `npm run knip`, `go test ./internal/ui/...`, `go vet ./...`, `go build -o pi-web ./cmd/pi-web`, full Desktop-Chrome e2e **56 passed / 2 skipped / 1 documented load-earlier retry passed**; full 7-project e2e matrix **341 passed / 71 skipped / 1 documented load-earlier retry passed**. |
| ✅ DONE | **Final docs pass (Phase 4 state).** Updated `AGENTS.md`, `docs/dev/templates-vs-web.md`, `docs/architecture/system-overview.md`, and `docs/architecture/frontend.md` so the frontend architecture reflects Svelte-owned index/settings routes, `CommandPalette.svelte`, and `VersionController.svelte`. |

| Status | Item |
|---|---|
| ✅ DONE + verified | **`live-events`/`live-scroll`/`live-stats` → `<LiveReload>` `<script module>`.** Absorbed the three LiveReload-exclusive SSE/scroll/stats primitive modules (~290 LOC) into `LiveReload.svelte`'s `<script module>` (exported, so their unit tests drive them directly); the instance `onMount` calls them. Removed the now-redundant `isAtBottom`/`scrollToBottom`/`scrollElementAboveComposer` onMount wrappers (they'd have recursed against the absorbed module-scope functions — same hazard as the thinking selector). **`chat-preview.js` deliberately KEPT** as a shared module — it's also imported by `<BtwPopup>`. **3 modules DELETED**; their tests moved to `components/session/` with imports repointed to `./LiveReload.svelte` (all 10 cases green). The two `export_html` follow/scroll + SSE source guards repointed to read `LiveReload.svelte` (which now contains that source). Verified: web 531 + knip clean + build (no a11y) + `go test ./internal/ui` + go vet + Desktop-Chrome e2e (live-reload/chat/btw/context-usage green; full **57/2**). |
| ✅ DONE + verified | **`session-entry-renderer.js` (638 LOC) → `<SessionEntry>` + `<ToolCall>` + `<ToolOutput>` + `<AskQuestion>`.** The message-pane renderer is now real Svelte components (shared live + export): `<SessionEntry>` dispatches entry types declaratively, `<ToolCall>` dispatches tool names, `<ToolOutput>` is the expandable output, `<AskQuestion>` is the interactive ask-user-question card. `{@html}` is used **only** for markdown (`safeMarkedParse`) + pre-rendered ANSI custom-tool HTML — everything else is escaped template, so **no `.js` does innerHTML view rendering** (criterion 1 met for the message pane). Pure helpers split out to `render/entry-format.js`; the download/share/copy utilities to `render/session-entry-actions.js` (used by the live runtime + export). `<SessionContent>` renders `<SessionEntry>` from the model (no injected `renderEntry`); code highlighting stays a post-render pass (live: `applyLazyHighlighting`; export: a synchronous `highlightPending` in `afterRender`). **`session-entry-renderer.js` + test DELETED** (render tests → `SessionEntry`/`ToolCall` component tests; share/copy → `session-entry-actions.test.js`). Two Go guards rewritten: the toggle-markup guard → `SessionEntry`/`ToolOutput`; the ask-question guards → `ToolCall`/`AskQuestion`. **Bug caught by e2e:** the live-only fork/label buttons were gated by a DOM probe evaluated at entry-creation, but `<SessionEntry>` mounts before `<ChatComposer>` → buttons missing; fixed by passing a `live` prop (SessionPage `true`, export default `false`). Verified: web 531 + knip clean + build (no a11y) + `go test ./internal/ui` (incl. export self-containment guard) + go vet + Desktop-Chrome e2e (session-view/annotations/labels/chat/share green; full **57/2**). Annotation offsets re-anchor correctly into the component-rendered DOM. |
| ✅ DONE + verified | **Four chat selectors → `<ChatComposer>` `<script module>`.** Absorbed `model-selector.js`, `thinking-selector.js`, `slash-command.js`, `mention-autocomplete.js` (≈808 LOC) into ChatComposer's module script as exported functions. `runChatComposer`'s selector params now **default** to the absorbed setups (`modelSelector = { setupModelSelector }`, etc.) so production uses them while the runner's tests still inject mocks. The pure `chat-selectors.js` helpers stay a module (imported by the absorbed code). **4 modules DELETED**; their 4 test files moved to `components/session/` with the import path repointed to `./ChatComposer.svelte` — all 54 selector cases + 18 runner cases green. **Bug caught by e2e:** the runner's internal thinking wrapper was named `setupThinkingLevelSelector` — identical to the absorbed export — so the param default `{ setupThinkingLevelSelector }` bound to the wrapper → infinite recursion (slash/mention setup never ran). Fixed by renaming the wrapper to `loadThinkingSelector` (matching `loadModelSelector`/`loadSlashSelector`/`loadMentionSelector`). Verified: web 527 + knip clean + build (no a11y) + `go test ./internal/ui` + go vet + Desktop-Chrome e2e (slash/mention/composer-keyboard/chat/context-usage green; full **57/2**). |
| ✅ DONE + verified | **`chat-composer-runner.js` (1121 LOC) → `<ChatComposer>`.** Moved `runChatComposer` verbatim into `ChatComposer.svelte`'s `<script module>` (exported, keeping its full DI signature); the instance `<script>` `onMount` calls it exactly as before. The model/thinking/slash/mention selectors + `chat-api` stay as injected helper modules (passed in). Module-scope `icon`/`t`/`X`/`TextQuote` feed the runner; the markup reuses them. **`chat-composer-runner.js` DELETED**; its 586-LOC / 18-case behavioural suite moved to `components/session/ChatComposer.test.js` with only the import path repointed to `./ChatComposer.svelte` (the `<script module>` export) — **zero test rewrites**, all 18 still green. Verified: web 527 + knip clean + build (no a11y) + autofixer clean + `go test ./internal/ui` + go vet + Desktop-Chrome e2e (chat/slash/mention/context-usage/composer-keyboard/btw green; full **57/2**). |
| ✅ DONE + verified | **`live-reload-runner.js` → `<LiveReload>` (reactive-only).** Absorbed the 371-LOC runner into `LiveReload.svelte`'s `onMount`: SSE connect/reconnect/backoff, the follow/scroll state machine, the streaming chat-preview wiring, stats/title updates, and the new-entry highlight (`highlightNewEntry` inlined). Hardcoded reactive mode — the dead non-reactive DOM-patching branch (`appendEntry`/`upsertEntry`/`refreshEntriesAffectedByToolResult`/`createSeenEntrySet`) is gone; reload reconciles purely via `window.__piReconcileEntries` and tracks new ids for follow/scroll. The streaming preview's `renderMarkdown` now uses the shared `safeMarkedParse` (globally-configured/sanitized marked) with an `escapeHtml` fallback, so the parallel renderer dies. Added an unmount disposer (closes the EventSource, clears the timer, removes listeners). **DELETED `live-reload-runner.js`, `live-renderer.js`, `live-entries.js` (+ their tests)** — the second imperative entry renderer + the imperative `#messages` patchers. **Kept** as live helpers: `live-events.js` (SSE/reload primitives), `live-scroll.js`, `live-stats.js`, `chat-preview.js`. Go guards updated: the two `export_html` source guards repoint runner→`LiveReload.svelte`; `TestLiveReloadUpdatesExistingAssistantWhenToolResultsArrive` removed (the reactive model + `<SessionContent>` now provide that guarantee); `TestLiveReloadEntriesInheritCurrentToggleState` trimmed to the shared hook; the renderer-markup guard repoints to `session-entry-renderer.js`. Verified: web 527 + knip clean + build (no a11y) + autofixer clean + `go test ./internal/ui` + go vet + Desktop-Chrome e2e (live-reload/chat/btw/context-usage green; full **57/2**). |
| ✅ DONE + verified | **`GitFooter.svelte`** (chat tranche, first cut). Extracted the git bar (branch indicator + smart PR split button + branch rename) from `git-footer.js` (264 LOC, called directly in `ChatComposer.onMount`) into a child `<GitFooter {sessionId} />` that owns the `.pi-git-bar` markup — including the always-available `#pi-btw-button` (still wired by `<BtwPopup>`). `git-api.js` stays as a **pure** fetch helper (injectable `gitApi` prop, default = the real module). Dropped the dead **dataset-sync first-paint path** (the SPA never stamps `data-git-*`, so it was inert — the bar is driven by the async `getGitInfo`). **`chat/git-footer.js` + `git-footer.test.js` DELETED** (ported to `GitFooter.test.js`, 8 cases). Verified: web 534 + knip clean + no a11y (only the standard `{@html icon}` notes) + `go test ./internal/ui` + go vet + Desktop-Chrome e2e (chat/btw/composer/slash/mention green; full 57/2). |
| 🔶 remaining | **Phase 2 was NOT isolatable from `session.js` (resolved for tree+header).** The tree's rendering, the active leaf/target (`currentLeafId`/`currentTargetId`), and `filterMode`/`searchQuery` all live as imperative locals in `session.js` (and `export-entry.js`); tree clicks drive **content** rendering via the navigator. Swapping only the tree DOM to `<SessionTreeNodes>` would need a throwaway bridge between that imperative state and the reactive model — which Phase 3 then deletes. **Do the tree cut-over together with moving navigation + filter state into `SessionDataModel`** (i.e. merge the front of Phase 3 into Phase 2), so the model is the single source of truth and `session.js`/`export-entry.js` stop owning that state. The staged `TreeNode`/`SessionTreeNodes` components are ready for that step. |

**Recommended next step (combined Phase 2/3a):** move `currentLeafId`,
`currentTargetId`, `filterMode`, `searchQuery` ownership into `SessionDataModel`;
have `session.js` (live) and `export-entry.js` read/write the model instead of
locals; render `<SessionTreeNodes>` from `SessionTree.svelte` (live) and the
export app; keep the navigator as the **content** driver but feed it from the
model; then delete `tree-renderer.js`. Verify with `npm run test`,
`npm run build`, the hardened guard, and `cd e2e && npx playwright test
--project="Desktop Chrome"`.

Verified green so far: `npm run test` (web, 539), `npm run build`
(live + export), `go test ./internal/ui/...`, and the Desktop-Chrome e2e
baseline. Pre-existing/unrelated: `internal/git TestDescribeDefaultBranch` fails
due to the sandbox commit-signing server (not caused by this work).
