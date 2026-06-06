// Reactive session model (Svelte 5 runes) — Phase 1 of the Svelte migration
// (see docs/dev/svelte-migration-plan.md).
//
// This is the single source of truth a session page hands down via Svelte
// context. It deliberately *reuses* the existing pure helpers in
// `session-data.js` / `session-tree.js` / `session-filter.js` rather than
// reimplementing them — the only thing added here is reactivity ($state /
// $derived) so that mutating `entries` (e.g. a live-reload) automatically
// recomputes the lookups, tree, active path and filtered view without any
// manual DOM diffing.
//
// It is intentionally framework-agnostic about *rendering*: it holds data and
// view state, nothing that touches SSE/fetch/the DOM. That keeps it safe to
// import from both the live app and the static export bundle.

import { createSessionDataModel, buildSessionLookups } from './session-data.js';
import {
  buildTree,
  buildTreeNodeMap,
  flattenTree,
  buildActivePathIds,
  findNewestLeaf,
} from '../tree/session-tree.js';
import { filterNodes } from '../tree/session-filter.js';

export class SessionDataModel {
  // ── raw data ──────────────────────────────────────────────────────────
  entries = $state([]);
  header = $state(null);
  systemPrompt = $state(null);
  tools = $state(null);
  renderedTools = $state(null);

  // pagination metadata (large-session tail windows)
  total = $state(0);
  from = $state(0);
  truncated = $state(false);

  // ── view state ────────────────────────────────────────────────────────
  currentLeafId = $state('');
  currentTargetId = $state('');
  filterMode = $state('default');
  searchQuery = $state('');
  urlLeafId = $state(null);
  urlTargetId = $state(null);

  // ── derived lookups / tree (recompute when `entries` changes) ──────────
  lookups = $derived(buildSessionLookups(this.entries));
  tree = $derived(buildTree(this.entries, this.lookups.labelMap));
  nodeMap = $derived(buildTreeNodeMap(this.tree));
  activePathIds = $derived(
    buildActivePathIds(this.currentTargetId || this.currentLeafId, this.lookups.byId),
  );
  flatNodes = $derived(flattenTree(this.tree, this.activePathIds));
  filteredNodes = $derived(
    filterNodes(this.flatNodes, this.currentLeafId, {
      filterMode: this.filterMode,
      searchQuery: this.searchQuery,
    }),
  );

  // convenience accessors mirroring the legacy plain model's field names so
  // consumers can read `model.byId` etc. without reaching through `.lookups`.
  get byId() {
    return this.lookups.byId;
  }
  get toolCallMap() {
    return this.lookups.toolCallMap;
  }
  get labelMap() {
    return this.lookups.labelMap;
  }

  constructor(data) {
    if (data) this.#hydrate(data);
  }

  // Build a reactive model straight from the embedded payload + URL params,
  // reusing the existing factory for all the parsing/defaulting rules.
  static fromPayload(payload, params = new URLSearchParams()) {
    return new SessionDataModel(createSessionDataModel(payload, params));
  }

  // Initial (or full) load: reset both data and view state from a payload-
  // shaped object (as produced by createSessionDataModel).
  load(data) {
    this.#hydrate(data);
  }

  // Replace the model's data in place. Reassigning `entries` (a single $state
  // write) invalidates every $derived above, so the whole view recomputes.
  // This is what live-reload will call in a later phase instead of patching
  // the DOM by hand. View state (filter/search/current ids) is preserved.
  applyLiveUpdate(data) {
    this.#hydrate(data, { preserveView: true });
  }

  #hydrate(data, { preserveView = false } = {}) {
    this.entries = Array.isArray(data.entries) ? data.entries : [];
    this.header = data.header ?? null;
    this.systemPrompt = data.systemPrompt ?? null;
    this.tools = data.tools ?? null;
    this.renderedTools = data.renderedTools ?? null;
    this.total = Number.isInteger(data.total) ? data.total : this.entries.length;
    this.from = Number.isInteger(data.from) ? data.from : 0;
    this.truncated = Boolean(data.truncated) || this.from > 0 || this.entries.length < this.total;

    this.urlLeafId = data.urlLeafId ?? null;
    this.urlTargetId = data.urlTargetId ?? null;

    if (!preserveView) {
      this.currentLeafId = data.leafId ?? data.defaultLeafId ?? '';
      this.currentTargetId = data.urlTargetId || this.currentLeafId;
    } else if (this.currentLeafId && !this.lookups.byId.has(this.currentLeafId)) {
      // The previously-active leaf vanished (e.g. a branch was pruned upstream);
      // fall back to the freshest leaf so the view stays on something real.
      this.currentLeafId = data.leafId ?? this.currentLeafId;
    }
  }

  // Move the active leaf/target to a node, defaulting the target to the leaf.
  navigateTo(leafId, targetId = leafId) {
    this.currentLeafId = leafId;
    this.currentTargetId = targetId;
  }

  // The newest leaf under a node — handy for "jump to latest".
  newestLeaf(nodeId) {
    return findNewestLeaf(nodeId, this.nodeMap);
  }
}
