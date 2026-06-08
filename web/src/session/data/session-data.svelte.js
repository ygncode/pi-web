// Reactive session model (Svelte 5 runes) — see docs/dev/svelte-migration-plan.md.
//
// This is the single source of truth for a session page. It is intentionally a
// DROP-IN for the legacy plain data model produced by createSessionDataModel()
// (session-data.js): it exposes the same fields (entries, header, byId,
// toolCallMap, labelMap, leafId, urlTargetId, systemPrompt, tools,
// renderedTools, total/from/truncated) so the imperative session.js / export
// runtimes can use it via the session runtime context/window shim with no field changes —
// while ALSO being reactive so the Svelte tree updates automatically.
//
// Key reactivity rules that keep it compatible with the imperative code:
//   • `entries` is a $state array → session.js's in-place splice() is tracked.
//   • byId / toolCallMap / labelMap are STABLE SvelteMaps, refilled IN PLACE
//     (clear+set). Stable identity matters because the entry renderer / chat
//     composer capture these Map references once; mutating-in-place keeps that
//     capture live. SvelteMap (not a plain `$state(new Map())`) is required so
//     that .set/.clear are themselves reactive — a derived that reads byId must
//     recompute when entries are prepended without the active leaf changing
//     (e.g. the load-earlier path), where no other reactive field changes.
//   • view state (currentLeafId/currentTargetId/filterMode/searchQuery) is
//     $state, so the tree highlight/filter follow navigation reactively.
//
// It deliberately holds no rendering/DOM/SSE/fetch logic, so it is safe to
// import from both the live app and the static export bundle.

import { SvelteMap } from 'svelte/reactivity';
import { buildSessionLookups } from './session-data.js';
import {
  buildTree,
  buildTreeNodeMap,
  flattenTree,
  buildActivePathIds,
  findNewestLeaf,
  getPath,
} from '../tree/session-tree.js';
import { filterNodes } from '../tree/session-filter.js';

function refillMap(target, source) {
  target.clear();
  if (source) source.forEach((value, key) => target.set(key, value));
}

export class SessionDataModel {
  // ── raw data (drop-in fields for the legacy plain model) ────────────────
  entries = $state([]);
  header = $state(null);
  systemPrompt = $state(null);
  tools = $state(null);
  renderedTools = $state(null);
  leafId = $state('');
  urlLeafId = $state(null);
  urlTargetId = $state(null);
  total = $state(0);
  from = $state(0);
  truncated = $state(false);

  // Stable, in-place-mutated reactive lookup Maps (see header comment).
  // SvelteMap makes .set/.clear reactive while keeping a stable object identity.
  byId = new SvelteMap();
  toolCallMap = new SvelteMap();
  labelMap = new SvelteMap();

  // ── view state ──────────────────────────────────────────────────────────
  currentLeafId = $state('');
  currentTargetId = $state('');
  filterMode = $state('default');
  searchQuery = $state('');

  // ── derived tree (recompute on entries / labelMap / view changes) ────────
  tree = $derived(buildTree(this.entries, this.labelMap));
  nodeMap = $derived(buildTreeNodeMap(this.tree));
  activePathIds = $derived(
    buildActivePathIds(this.currentTargetId || this.currentLeafId, this.byId),
  );
  // Ordered root→leaf entries for the message pane (what the content view
  // renders). Recomputes when entries or the active leaf change.
  activePath = $derived(getPath(this.currentLeafId, this.byId));
  flatNodes = $derived(flattenTree(this.tree, this.activePathIds));
  filteredNodes = $derived(
    filterNodes(this.flatNodes, this.currentLeafId, {
      filterMode: this.filterMode,
      searchQuery: this.searchQuery,
    }),
  );

  constructor(data) {
    if (data) this.#hydrate(data);
  }

  // Build a reactive model straight from an embedded payload + URL params.
  static fromPayload(payload, params = new URLSearchParams()) {
    // Lazy import avoidance: createSessionDataModel lives in session-data.js and
    // would create a cycle if imported at top level alongside buildSessionLookups
    // there; build the shape inline instead.
    const header = payload?.header || {};
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    const defaultLeafId = payload?.leafId || '';
    return new SessionDataModel({
      header,
      entries,
      leafId: params.get('leafId') || defaultLeafId,
      urlLeafId: params.get('leafId'),
      urlTargetId: params.get('targetId'),
      systemPrompt: payload?.systemPrompt ?? null,
      tools: payload?.tools ?? null,
      renderedTools: payload?.renderedTools ?? null,
      total: payload?.total,
      from: payload?.from,
      truncated: payload?.truncated,
    });
  }

  // Initial / full load: reset data + view state from a payload-shaped object
  // (as produced by createSessionDataModel or fromPayload's argument).
  load(data) {
    this.#hydrate(data);
  }

  // Replace data in place, preserving view state. Used by the static export and
  // by standalone consumers; the live app drives reloads through session.js,
  // which mutates this model's entries/maps directly.
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

    // Refill the stable lookup maps in place from the entries (authoritative),
    // keeping their object identity for any captured references.
    const lk = buildSessionLookups(this.entries);
    refillMap(this.byId, lk.byId);
    refillMap(this.toolCallMap, lk.toolCallMap);
    refillMap(this.labelMap, lk.labelMap);

    this.leafId = data.leafId ?? data.defaultLeafId ?? '';

    if (!preserveView) {
      this.currentLeafId = this.leafId;
      this.currentTargetId = data.urlTargetId || this.currentLeafId;
    } else if (this.currentLeafId && !this.byId.has(this.currentLeafId)) {
      this.currentLeafId = this.leafId || this.currentLeafId;
    }
  }

  // Move the active leaf/target (target defaults to the leaf).
  navigateTo(leafId, targetId = leafId) {
    this.currentLeafId = leafId;
    this.currentTargetId = targetId;
  }

  // Newest leaf under a node — used for click-to-navigate.
  newestLeaf(nodeId) {
    return findNewestLeaf(nodeId, this.nodeMap);
  }

  // Live-reload / load-earlier reconciliation: replace entries in place and
  // refill the stable lookup maps (all reactive, so the Svelte tree, content
  // pane, and artifact panel update automatically), then advance the active
  // leaf to the newest descendant of the current one (or the last real entry).
  // Unlike load(), this preserves view state and never resets the target unless
  // it was unset.
  reconcile(entries) {
    if (!Array.isArray(entries)) return;
    this.entries.splice(0, this.entries.length, ...entries);
    const lk = buildSessionLookups(this.entries);
    refillMap(this.byId, lk.byId);
    refillMap(this.toolCallMap, lk.toolCallMap);
    refillMap(this.labelMap, lk.labelMap);

    const nodeMap = buildTreeNodeMap(buildTree(this.entries, this.labelMap));
    let nextLeafId = this.currentLeafId && nodeMap.has(this.currentLeafId)
      ? findNewestLeaf(this.currentLeafId, nodeMap)
      : '';
    if (!nextLeafId) {
      for (let i = this.entries.length - 1; i >= 0; i -= 1) {
        if (this.entries[i]?.id && this.entries[i]?.type !== 'label') {
          nextLeafId = this.entries[i].id;
          break;
        }
      }
    }
    if (nextLeafId) {
      this.leafId = nextLeafId;
      this.currentLeafId = nextLeafId;
      if (!this.currentTargetId) this.currentTargetId = nextLeafId;
    }
  }
}
