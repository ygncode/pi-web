import { marked } from 'marked';

import { buildSessionLookups, loadSessionData, getSessionSearchParams } from './data/session-data.js';
import { buildActivePathIds as buildActivePathIdsForModel, buildTree as buildTreeForModel, buildTreeNodeMap, buildTreePrefix, findNewestLeaf as findNewestLeafInTree, flattenTree, getPath as getPathForModel } from './tree/session-tree.js';
import { extractContent, filterNodes as filterNodesForState, getSearchableText, hasTextContent, recalculateVisualStructure } from './tree/session-filter.js';
import { escapeHtml, formatToolCall, getTreeNodeDisplayHtml as getTreeNodeDisplayHtmlForState, shortenPath, truncate } from './render/session-format.js';
import { configureSessionMarkdown, safeMarkedParse } from './render/markdown.js';
import * as sessionHeaderRenderer from './render/session-header-renderer.js';
import * as sessionEntryRenderer from './render/session-entry-renderer.js';
import { createTreeRenderer } from './tree/tree-renderer.js';
import { createSessionNavigator } from './navigation/session-navigation.js';
import * as toggleStateApi from './ui/toggle-state.js';
import * as sidebarApi from './ui/sidebar.js';
import * as searchFiltersApi from './ui/search-filters.js';
import { setupSessionUi } from './ui/session-ui-runner.js';
import * as chatComposerRunner from './chat/chat-composer-runner.js';
import * as doneNotifier from './chat/done-notifier.js';
import * as chatApi from './chat/chat-api.js';
import * as chatSelectors from './chat/chat-selectors.js';
import * as thinkingSelector from './chat/thinking-selector.js';
import * as modelSelector from './chat/model-selector.js';
import * as liveReloadRunner from './live/live-reload-runner.js';
import * as liveScroll from './live/live-scroll.js';
import * as liveStats from './live/live-stats.js';
import * as liveEntries from './live/live-entries.js';
import * as chatPreview from './live/chat-preview.js';
import * as updateIndicator from './live/update-indicator.js';
import * as shareOverlay from './live/share-overlay.js';
import * as resumeButton from './live/resume-button.js';
import * as newSessionButton from './live/new-session-button.js';
import * as liveEvents from './live/live-events.js';
import * as liveRenderer from './live/live-renderer.js';
import { setupCommandMenu } from './live/command-menu.js';
import { createVersionController } from '../shared/version.js';
import { setupKeyboardNav } from '../shared/keyboard-nav.js';
import { toggleTheme, syncThemeIcons } from '../shared/theme.js';
import { setupSessionListPalette } from '../shared/session-list-palette.js';
import { showShortcutsModal } from './live/shortcuts-modal.js';
export { buildSessionLookups, createSessionDataModel, decodeBase64JSON, getSessionSearchParams, loadSessionData, readSessionPayload } from './data/session-data.js';
export { buildActivePathIds, buildTree, buildTreeNodeMap, buildTreePrefix, findNewestLeaf, flattenTree, getPath } from './tree/session-tree.js';
export { createTreeRenderer } from './tree/tree-renderer.js';
export { createSessionNavigator } from './navigation/session-navigation.js';
export { extractContent, filterNodes, getSearchableText, hasTextContent, recalculateVisualStructure } from './tree/session-filter.js';
export { escapeHtml, formatToolCall, getTreeNodeDisplayHtml, shortenPath, truncate } from './render/session-format.js';

export const sessionEntrypointLoaded = true;

function applyLazyHighlighting(documentImpl) {
  import('highlight.js').then(({ default: hljs }) => {
    documentImpl.querySelectorAll('code[data-highlight-pending]').forEach(el => {
      const lang = el.dataset.lang;
      const text = el.textContent;
      try {
        el.innerHTML = lang && hljs.getLanguage(lang)
          ? hljs.highlight(text, { language: lang }).value
          : hljs.highlightAuto(text).value;
      } catch { /* keep plain text */ }
      el.removeAttribute('data-highlight-pending');
      el.removeAttribute('data-lang');
    });
  });
}

export function runSessionApp({ target = window } = {}) {
  const documentImpl = target.document;
  target.marked = target.marked || marked;
  const dataModel = target.__piSessionDataModel || loadSessionData({
    documentImpl,
    windowImpl: target,
    atobImpl: target.atob?.bind(target)
  });
  target.__piSessionDataModel = dataModel;
  const sessionId = getSessionSearchParams(target.location).get('id') || '';
  const hljs = null; // loaded lazily after initial render via applyLazyHighlighting

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
      escapeHtmlImpl: (text) => escapeHtml(text, { documentImpl })
    })
  };

  function replaceMapContents(targetMap, nextMap) {
    targetMap.clear();
    nextMap.forEach((value, key) => targetMap.set(key, value));
  }

  function syncDataModelEntries(entries = []) {
    if (!Array.isArray(entries)) return;
    dataModel.entries.splice(0, dataModel.entries.length, ...entries);
    const lookups = buildSessionLookups(dataModel.entries);
    replaceMapContents(dataModel.byId, lookups.byId);
    replaceMapContents(dataModel.toolCallMap, lookups.toolCallMap);
    replaceMapContents(dataModel.labelMap, lookups.labelMap);

    const roots = buildTreeForModel(dataModel.entries, dataModel.labelMap);
    const nodeMap = buildTreeNodeMap(roots);
    let nextLeafId = currentLeafId && nodeMap.has(currentLeafId)
      ? findNewestLeafInTree(currentLeafId, nodeMap)
      : '';
    if (!nextLeafId) {
      for (let i = dataModel.entries.length - 1; i >= 0; i -= 1) {
        if (dataModel.entries[i]?.id) {
          nextLeafId = dataModel.entries[i].id;
          break;
        }
      }
    }
    if (nextLeafId) {
      dataModel.leafId = nextLeafId;
      currentLeafId = nextLeafId;
      if (!currentTargetId) currentTargetId = nextLeafId;
      if (treeRenderer) {
        treeRenderer.currentLeafId = currentLeafId;
        treeRenderer.currentTargetId = currentTargetId;
      }
    }

    // Live reload reconciles the data model when the session JSONL changes,
    // but the tree renderer normally only patches active/path classes after
    // its initial DOM build. Force a full rebuild so newly appended entries
    // are added to the sidebar immediately.
    if (treeRenderer) {
      syncTreeRendererState();
      treeRenderer.forceTreeRerender();
    }
  }

  const sessionTree = {
    buildTree: () => buildTreeForModel(dataModel.entries, dataModel.labelMap),
    buildActivePathIds: (targetId) => buildActivePathIdsForModel(targetId, dataModel.byId),
    getPath: (targetId) => getPathForModel(targetId, dataModel.byId),
    findNewestLeaf: (nodeId) => {
      const roots = buildTreeForModel(dataModel.entries, dataModel.labelMap);
      return findNewestLeafInTree(nodeId, buildTreeNodeMap(roots));
    },
    flattenTree,
    buildTreePrefix
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
    BlobImpl: target.Blob
  });
  target.downloadSessionJson = entryRenderer.downloadSessionJson;

  const renderHeader = () => sessionHeaderRenderer.renderSessionHeader({
    header: dataModel.header,
    entries: dataModel.entries,
    systemPrompt: dataModel.systemPrompt,
    tools: dataModel.tools,
    escapeHtml: sessionFormat.escapeHtml,
    formatTokens: entryRenderer.formatTokens
  });

  const ui = setupSessionUi({
    documentImpl,
    windowImpl: target,
    storage: target.localStorage,
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
    projectPath: dataModel.header?.cwd || ''
  });

  const navigateTo = (targetId, scrollMode = 'target', scrollToEntryId = null) => navigatorInstance.navigateTo(targetId, scrollMode, scrollToEntryId);
  const renderEntryToNode = (entry) => navigatorInstance.renderEntryToNode(entry);

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
    closeSidebar: ui.closeSidebar
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
    onFork: (entryId, btn) => {
      if (!target.confirm('Are you sure you want to fork a new session starting from this message?')) {
        return;
      }
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<svg class="spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`;
      btn.disabled = true;

      const url = `?id=${encodeURIComponent(sessionId)}`;
      target.fetch(`/api/fork-session${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            target.location.href = '/session?id=' + encodeURIComponent(data.id);
          } else {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            let notice = documentImpl.getElementById('command-menu-toast');
            if (notice) {
              notice.textContent = data.error || 'Fork failed';
              notice.classList.add('visible');
              setTimeout(() => notice.classList.remove('visible'), 1500);
            } else {
              target.alert(data.error || 'Fork failed');
            }
          }
        })
        .catch((err) => {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
          target.alert('Fork failed');
        });
    }
  });

  target.navigateTo = navigateTo;
  target.renderEntryToNode = renderEntryToNode;
  target.__piTreeRenderer = treeRenderer;
  target.__piSessionNavigator = navigatorInstance;

  // Replace the server-rendered first-message LCP stub with the canonical
  // active path before live reload starts. Otherwise reload appends canonical
  // entries below the stub and the conversation appears duplicated.
  navigateTo(currentLeafId, dataModel.urlTargetId ? 'target' : 'bottom', dataModel.urlTargetId || null);

  doneNotifier.setupDoneNotifyToggle({ documentImpl, windowImpl: target });
  target.addEventListener('pi-worker-done', () => {
    doneNotifier.notifyDone({ documentImpl, windowImpl: target });
  });

  globalThis.__PI_TEST_LIVE_RELOAD_HOOK__?.();
  liveReloadRunner.runLiveReload({
    documentImpl,
    windowImpl: target,
    locationImpl: target.location,
    navigatorImpl: target.navigator,
    markedImpl: marked,
    fetchImpl: target.fetch.bind(target),
    EventSourceImpl: target.EventSource,
    requestAnimationFrameImpl: target.requestAnimationFrame.bind(target),
    setTimeoutImpl: target.setTimeout.bind(target),
    clearTimeoutImpl: target.clearTimeout.bind(target),
    liveEntries,
    liveRenderer,
    liveScroll,
    liveStats,
    liveEvents,
    updateIndicator,
    chatPreview,
    shareOverlay,
    resumeButton,
    newSessionButton,
    cwd: dataModel.header?.cwd || '',
    onSessionDataReload: (data) => syncDataModelEntries(data.entries)
  });

  setupKeyboardNav({ windowImpl: target, documentImpl });

  createVersionController({ documentImpl, windowImpl: target });

  setupCommandMenu({
    documentImpl,
    windowImpl: target,
    setSidebarOpen: (open) => sidebarApi.setSidebarOpen(open, { documentImpl }),
    setSidebarCollapsed: (collapsed) => sidebarApi.setSidebarCollapsed(collapsed, { documentImpl }),
    getEntries: () => dataModel.entries,
    getLeafId: () => currentLeafId,
    escapeHtml: sessionFormat.escapeHtml,
    formatTokens: entryRenderer.formatTokens,
  });

  // Set up session list palette (Cmd+K / "List Sessions" menu item)
  setupCommandMenu._palette = setupSessionListPalette({
    documentImpl,
    windowImpl: target,
    overlayId: 'sessionPalette',
    searchInputId: 'session-palette-search',
    clearOnClose: true,
    onNewSession: () => {
      const newBtn = documentImpl.getElementById('new-btn');
      if (newBtn) newBtn.click();
    },
  });

  // Cmd+K keyboard shortcut for session list palette
  target.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (setupCommandMenu._palette) setupCommandMenu._palette.open();
    }
  });

  // Cmd+B keyboard shortcut to toggle sidebar/tree
  target.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      const sidebar = documentImpl.getElementById('sidebar');
      if (target.matchMedia('(max-width: 900px)').matches) {
        const isOpen = sidebar?.classList.contains('open');
        sidebarApi.setSidebarOpen(!isOpen, { documentImpl });
      } else {
        const isCollapsed = documentImpl.body?.classList.contains('sidebar-collapsed');
        const next = !isCollapsed;
        sidebarApi.setSidebarCollapsed(next, { documentImpl });
        sidebarApi.saveSidebarCollapsed(next);
      }
    }
  });

  // Cmd+T keyboard shortcut for new session
  target.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
      e.preventDefault();
      const newBtn = documentImpl.getElementById('new-btn');
      if (newBtn) newBtn.click();
    }
  });

  // Cmd+Shift+L keyboard shortcut for system theme toggle
  // Use capture phase so the browser doesn't swallow Cmd+Shift+L before we see it.
  target.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme(target, documentImpl);
      syncThemeIcons(documentImpl);
    }
  }, { capture: true });

  // Cmd+Shift+N keyboard shortcut to toggle scratchpad (right sidebar)
  target.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      ui.toggleRightSidebar();
    }
  });

  // Cmd+/ keyboard shortcut to show keyboard shortcuts help modal
  target.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      showShortcutsModal({ documentImpl, windowImpl: target });
    }
  });

  const shortcutsBtn = documentImpl.getElementById('shortcuts-help-btn');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showShortcutsModal({ documentImpl, windowImpl: target });
    });
  }

  // Initialize chat after live reload so the optimistic "message sent" event
  // has a listener before the user can submit. Otherwise cold-start sends can
  // clear/disable the composer without rendering the pending message preview.
  globalThis.__PI_TEST_CHAT_COMPOSER_HOOK__?.();
  chatComposerRunner.runChatComposer({
    documentImpl,
    windowImpl: target,
    locationImpl: target.location,
    localEntries: dataModel.entries,
    leafId: dataModel.leafId,
    urlTargetId: dataModel.urlTargetId,
    byId: dataModel.byId,
    navigateTo,
    escapeHtml: sessionFormat.escapeHtml,
    chatApi,
    chatSelectors,
    modelSelector,
    thinkingSelector,
    FormDataImpl: target.FormData,
    URLSearchParamsImpl: target.URLSearchParams,
    CustomEventImpl: target.CustomEvent,
    setIntervalImpl: target.setInterval.bind(target)
  });

  // Handle Visual Viewport changes to prevent mobile browsers from shifting
  // the top fixed header out of view when the virtual keyboard is open.
  if (target.visualViewport) {
    const handleVisualViewportChange = () => {
      const height = target.visualViewport.height;
      documentImpl.documentElement.style.setProperty('--viewport-height', `${height}px`);

      // Dynamically adjust the top header's vertical position to offset
      // layout viewport scroll/shift caused by mobile virtual keyboard.
      const offsetTop = target.visualViewport.offsetTop;
      const header = documentImpl.querySelector('.session-header-bar');
      if (header) {
        header.style.transform = `translateY(${Math.max(0, offsetTop)}px)`;
      }
    };
    target.visualViewport.addEventListener('resize', handleVisualViewportChange);
    target.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    handleVisualViewportChange();
  }

  // Prevent mobile browser from auto-scrolling the layout viewport when keyboard opens
  target.addEventListener('scroll', () => {
    if (target.scrollY !== 0 || target.scrollX !== 0) {
      target.scrollTo(0, 0);
    }
  });
  documentImpl.addEventListener('scroll', () => {
    if (documentImpl.documentElement.scrollTop !== 0 || documentImpl.documentElement.scrollLeft !== 0) {
      documentImpl.documentElement.scrollTop = 0;
      documentImpl.documentElement.scrollLeft = 0;
    }
    if (documentImpl.body.scrollTop !== 0 || documentImpl.body.scrollLeft !== 0) {
      documentImpl.body.scrollTop = 0;
      documentImpl.body.scrollLeft = 0;
    }
  });
}


if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById('session-data')) {
  runSessionApp();
  applyLazyHighlighting(document);
}
