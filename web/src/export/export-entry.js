// Static export snapshot entry point.
//
// Renders a self-contained session snapshot (GitHub Gist) using the SAME
// rendering modules as the live app (web/src/session/*). It deliberately omits
// every live-only concern: no SSE/live-reload, no chat composer, no
// artifacts/annotations, no fetch-backed features. Those DOM hosts are not
// emitted by the server when IsLive is false, so the shared UI helpers no-op.
//
// marked and highlight.js are provided as window globals by the inlined vendor
// <script> tags (see internal/ui/export.go); they are marked external in the
// export Vite build, so this bundle reads window.marked / window.hljs.

import {
  loadSessionData,
  buildSessionLookups,
  getSessionSearchParams,
} from '../session/data/session-data.js';
import {
  buildActivePathIds as buildActivePathIdsForModel,
  buildTree as buildTreeForModel,
  buildTreeNodeMap,
  buildTreePrefix,
  findNewestLeaf as findNewestLeafInTree,
  flattenTree,
  getPath as getPathForModel,
} from '../session/tree/session-tree.js';
import {
  extractContent,
  filterNodes as filterNodesForState,
} from '../session/tree/session-filter.js';
import {
  escapeHtml,
  formatToolCall,
  getTreeNodeDisplayHtml as getTreeNodeDisplayHtmlForState,
  shortenPath,
  truncate,
} from '../session/render/session-format.js';
import { configureSessionMarkdown, safeMarkedParse } from '../session/render/markdown.js';
import * as sessionHeaderRenderer from '../session/render/session-header-renderer.js';
import * as sessionEntryRenderer from '../session/render/session-entry-renderer.js';
import { createTreeRenderer } from '../session/tree/tree-renderer.js';
import { createSessionNavigator } from '../session/navigation/session-navigation.js';
import * as toggleStateApi from '../session/ui/toggle-state.js';
import * as sidebarApi from '../session/ui/sidebar.js';
import * as searchFiltersApi from '../session/ui/search-filters.js';
import { setupSessionUi } from '../session/ui/session-ui-runner.js';
import { setupImageModal } from '../session/ui/image-modal.js';
import { setupKeyboardNav } from '../shared/keyboard-nav.js';

// In a sandboxed iframe (e.g. a srcdoc preview without `allow-same-origin`),
// even *reading* the `localStorage` property throws SecurityError — which would
// abort the whole bootstrap and leave a blank page. A static snapshot has
// nothing meaningful to persist, so fall back to an in-memory shim. Returning a
// shim (never undefined) also keeps the shared modules off their
// `globalThis.localStorage` default, which would throw the same way.
function safeLocalStorage(target) {
  try {
    const ls = target.localStorage;
    if (ls) return ls;
  } catch {
    /* sandboxed: fall through to the in-memory shim */
  }
  const mem = new Map();
  return {
    getItem: (key) => (mem.has(key) ? mem.get(key) : null),
    setItem: (key, value) => { mem.set(key, String(value)); },
    removeItem: (key) => { mem.delete(key); },
    clear: () => { mem.clear(); },
  };
}

export function runExportApp({ target = window } = {}) {
  const documentImpl = target.document;
  const marked = target.marked;
  const hljs = target.hljs || null;
  const storage = safeLocalStorage(target);

  const dataModel = loadSessionData({
    documentImpl,
    windowImpl: target,
    atobImpl: target.atob?.bind(target),
  });
  const sessionId = getSessionSearchParams(target.location).get('id') || '';

  let filterMode = 'default';
  let searchQuery = '';
  target.__piFilterState = { filterMode, searchQuery };

  const sessionFormat = {
    shortenPath,
    formatToolCall,
    escapeHtml: (text) => escapeHtml(text, { documentImpl }),
    truncate,
    getTreeNodeDisplayHtml: (entry, label) => getTreeNodeDisplayHtmlForState(entry, label, {
      extractContent,
      toolCallMap: dataModel.toolCallMap,
      escapeHtmlImpl: (text) => escapeHtml(text, { documentImpl }),
    }),
  };

  const sessionTree = {
    buildTree: () => buildTreeForModel(dataModel.entries, dataModel.labelMap),
    buildActivePathIds: (targetId) => buildActivePathIdsForModel(targetId, dataModel.byId),
    getPath: (targetId) => getPathForModel(targetId, dataModel.byId),
    findNewestLeaf: (nodeId) => {
      const roots = buildTreeForModel(dataModel.entries, dataModel.labelMap);
      return findNewestLeafInTree(nodeId, buildTreeNodeMap(roots));
    },
    flattenTree,
    buildTreePrefix,
  };

  let currentLeafId = dataModel.leafId;
  let currentTargetId = dataModel.urlTargetId || dataModel.leafId;
  let treeRenderer;
  let navigatorInstance;

  const syncTreeRendererState = () => {
    target.__piFilterState.filterMode = filterMode;
    target.__piFilterState.searchQuery = searchQuery;
    treeRenderer.currentLeafId = currentLeafId;
    treeRenderer.currentTargetId = currentTargetId;
  };
  const renderTree = () => { syncTreeRendererState(); return treeRenderer.renderTree(); };
  const forceTreeRerender = () => { syncTreeRendererState(); return treeRenderer.forceTreeRerender(); };

  // hljs is available synchronously (inlined vendor script), so code blocks are
  // highlighted at parse time — no lazy pass like the live app needs.
  const entryRenderer = sessionEntryRenderer.createSessionEntryRenderer({
    entries: dataModel.entries,
    header: dataModel.header,
    toolCallMap: dataModel.toolCallMap,
    renderedTools: dataModel.renderedTools,
    currentLeafIdRef: () => currentLeafId,
    escapeHtml: sessionFormat.escapeHtml,
    shortenPath,
    formatToolCall,
    safeMarkedParse: (text) => safeMarkedParse(text, { marked }),
    hljs,
    documentImpl,
    windowImpl: target,
    navigatorImpl: target.navigator,
    URLImpl: target.URL,
    BlobImpl: target.Blob,
  });
  target.downloadSessionJson = entryRenderer.downloadSessionJson;

  const renderHeader = () => sessionHeaderRenderer.renderSessionHeader({
    header: dataModel.header,
    entries: dataModel.entries,
    systemPrompt: dataModel.systemPrompt,
    tools: dataModel.tools,
    escapeHtml: sessionFormat.escapeHtml,
    formatTokens: entryRenderer.formatTokens,
  });

  const ui = setupSessionUi({
    documentImpl,
    windowImpl: target,
    storage,
    marked,
    hljs,
    escapeHtml: sessionFormat.escapeHtml,
    markdownApi: { configureSessionMarkdown, safeMarkedParse },
    searchFiltersApi,
    sidebarApi,
    toggleStateApi,
    getLeafId: () => dataModel.leafId,
    setSearchQuery: (value) => { searchQuery = value; },
    setFilterMode: (value) => { filterMode = value; },
    forceTreeRerender,
    navigateTo: (...args) => navigateTo(...args),
    projectPath: dataModel.header?.cwd || '',
  });

  const navigateTo = (targetId, scrollMode = 'target', scrollToEntryId = null) =>
    navigatorInstance.navigateTo(targetId, scrollMode, scrollToEntryId);

  treeRenderer = createTreeRenderer({
    documentImpl,
    windowImpl: target,
    initialLeafId: currentLeafId,
    initialTargetId: currentTargetId,
    buildTree: sessionTree.buildTree,
    buildActivePathIds: sessionTree.buildActivePathIds,
    flattenTree,
    filterNodes: (flatNodes, leaf) => filterNodesForState(flatNodes, leaf, { filterMode, searchQuery }),
    buildTreePrefix,
    getTreeNodeDisplayHtml: sessionFormat.getTreeNodeDisplayHtml,
    findNewestLeaf: sessionTree.findNewestLeaf,
    navigateTo,
    isMobileLayout: ui.isMobileLayout,
    closeSidebar: ui.closeSidebar,
  });

  navigatorInstance = createSessionNavigator({
    documentImpl,
    windowImpl: target,
    getPath: sessionTree.getPath,
    renderTree,
    renderHeader,
    attachHeaderHandlers: ui.attachHeaderHandlers,
    renderEntry: entryRenderer.renderEntry,
    buildShareUrl: entryRenderer.buildShareUrl,
    copyToClipboard: entryRenderer.copyToClipboard,
    onNavigate: (leaf, targetId) => {
      currentLeafId = leaf;
      currentTargetId = targetId;
      treeRenderer.currentLeafId = leaf;
      treeRenderer.currentTargetId = targetId;
    },
    // No forking in a static snapshot — fork buttons are not rendered.
    onFork: () => {},
  });

  target.navigateTo = navigateTo;
  target.__piTreeRenderer = treeRenderer;
  target.__piSessionNavigator = navigatorInstance;

  setupKeyboardNav({ windowImpl: target, documentImpl });
  setupImageModal({ documentImpl });

  // Initial render: deep-link to the target message when the URL carries one,
  // otherwise show the active leaf path from the top.
  const leafId = dataModel.leafId;
  if (leafId) {
    if (dataModel.urlTargetId && dataModel.byId.has(dataModel.urlTargetId)) {
      navigateTo(leafId, 'target', dataModel.urlTargetId);
    } else {
      navigateTo(leafId, 'none');
    }
  } else if (dataModel.entries.length > 0) {
    navigateTo(dataModel.entries[dataModel.entries.length - 1].id, 'none');
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById('session-data')) {
  runExportApp();
}
