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
  getSessionSearchParams,
} from '../session/data/session-data.js';
import {
  extractContent,
} from '../session/tree/session-filter.js';
import {
  escapeHtml,
  formatToolCall,
  getTreeNodeDisplayHtml as getTreeNodeDisplayHtmlForState,
  shortenPath,
  truncate,
} from '../session/render/session-format.js';
import { configureSessionMarkdown, safeMarkedParse } from '../session/render/markdown.js';
import * as sessionEntryRenderer from '../session/render/session-entry-renderer.js';
import { mount } from 'svelte';
import SessionTreeNodes from '../components/session/SessionTreeNodes.svelte';
import SessionInfoHeader from '../components/session/SessionInfoHeader.svelte';
import SessionContent from '../components/session/SessionContent.svelte';
import ImageModal from '../components/session/ImageModal.svelte';
import { SessionDataModel } from '../session/data/session-data.svelte.js';
import { createSessionNavigator } from '../session/navigation/session-navigation.js';
import * as toggleStateApi from '../session/ui/toggle-state.js';
import * as sidebarApi from '../session/ui/sidebar.js';
import * as searchFiltersApi from '../session/ui/search-filters.js';
import { setupSessionUi } from '../session/ui/session-ui-runner.js';
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
  // Reactive model that drives the Svelte <SessionTreeNodes> sidebar (same
  // component the live app uses). The snapshot renders once — no live updates —
  // so this just computes the tree/active-path derivations a single time.
  const treeModel = new SessionDataModel(dataModel);
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

  let currentLeafId = dataModel.leafId;
  let currentTargetId = dataModel.urlTargetId || dataModel.leafId;
  let navigatorInstance;

  // Push view state into the reactive model; <SessionTreeNodes> recomputes.
  const syncTreeRendererState = () => {
    target.__piFilterState.filterMode = filterMode;
    target.__piFilterState.searchQuery = searchQuery;
    treeModel.filterMode = filterMode;
    treeModel.searchQuery = searchQuery;
    treeModel.currentLeafId = currentLeafId;
    treeModel.currentTargetId = currentTargetId;
  };
  const renderTree = () => { syncTreeRendererState(); };
  const forceTreeRerender = () => { syncTreeRendererState(); };

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

  // Nav + scroll only; <SessionContent> (mounted below) renders the message pane
  // reactively from treeModel.activePath, which onNavigate updates.
  navigatorInstance = createSessionNavigator({
    documentImpl,
    renderTree,
    onNavigate: (leaf, targetId) => {
      currentLeafId = leaf;
      currentTargetId = targetId;
      treeModel.currentLeafId = leaf;
      treeModel.currentTargetId = targetId;
    },
  });

  // Mount the reactive message pane into #messages (same component the live app
  // uses). The snapshot renders once; renderEntry/hljs are synchronous here, so
  // entries paint immediately. afterRender re-applies collapse/toggle state.
  const messagesEl = documentImpl.getElementById('messages');
  if (messagesEl) {
    mount(SessionContent, {
      target: messagesEl,
      props: {
        model: treeModel,
        renderEntry: entryRenderer.renderEntry,
        afterRender: (container) => target.applyToggleStateToNode?.(container),
      },
    });
  }

  // Mount the Svelte tree sidebar into #sidebar (the static #tree-container /
  // #tree-status were removed from session.html; the component renders them).
  const sidebarEl = documentImpl.getElementById('sidebar');
  if (sidebarEl) {
    mount(SessionTreeNodes, {
      target: sidebarEl,
      props: {
        model: treeModel,
        onNavigate: (id) => {
          const leaf = treeModel.newestLeaf(id) || id;
          navigateTo(leaf, 'target', id);
          if (ui.isMobileLayout()) ui.closeSidebar();
        },
      },
    });
  }

  // Mount the Svelte header card into #header-container (rendered once), then
  // bind its toggle buttons exactly once (the controller doesn't guard against
  // double-binding and the header no longer re-renders per navigation).
  const headerEl = documentImpl.getElementById('header-container');
  if (headerEl) {
    mount(SessionInfoHeader, { target: headerEl, props: { model: treeModel } });
  }
  ui.attachHeaderHandlers();

  target.navigateTo = navigateTo;
  target.__piSessionNavigator = navigatorInstance;

  setupKeyboardNav({ windowImpl: target, documentImpl });
  const imageModalHost = documentImpl.getElementById('image-modal-host');
  if (imageModalHost) mount(ImageModal, { target: imageModalHost });

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
