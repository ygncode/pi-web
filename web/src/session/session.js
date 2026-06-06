import { marked } from 'marked';
import { icon, Loader } from '../shared/icons.js';

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
import { collectArtifacts } from './artifacts/artifact-registry.js';
import { createArtifactPanel } from './artifacts/artifact-panel.js';
import { filterArtifacts, readArtifactSettings, ARTIFACT_SETTING_KEYS } from './artifacts/artifact-filter.js';
import { createAnnotationApi } from './annotations/annotation-api.js';
import { createAnnotationLayer } from './annotations/annotation-layer.js';
import { setupLoadEarlierBanner } from './ui/load-earlier.js';
import { setupImageModal } from './ui/image-modal.js';
import * as chatComposerRunner from './chat/chat-composer-runner.js';
import * as doneNotifier from './chat/done-notifier.js';
import * as chatApi from './chat/chat-api.js';
import * as gitApi from './chat/git-api.js';
import { setupGitFooter } from './chat/git-footer.js';
import { setupBtwPopup } from './live/btw-popup.js';
import * as chatSelectors from './chat/chat-selectors.js';
import * as thinkingSelector from './chat/thinking-selector.js';
import * as modelSelector from './chat/model-selector.js';
import * as slashSelector from './chat/slash-command.js';
import * as mentionSelector from './chat/mention-autocomplete.js';
import * as liveReloadRunner from './live/live-reload-runner.js';
import * as liveScroll from './live/live-scroll.js';
import * as liveStats from './live/live-stats.js';
import * as liveEntries from './live/live-entries.js';
import * as chatPreview from './live/chat-preview.js';
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
import { setupCatGatekeeper } from './cat-gatekeeper/cat-gatekeeper.js';
import { openLabelModal } from './ui/label-modal.js';
import { configureSettingsSync, hydrateSettings } from '../shared/settings-store.js';
import { t } from '../shared/i18n.js';
export { buildSessionLookups, createSessionDataModel, decodeBase64JSON, getSessionSearchParams, loadSessionData, readSessionPayload } from './data/session-data.js';
export { buildActivePathIds, buildTree, buildTreeNodeMap, buildTreePrefix, findNewestLeaf, flattenTree, getPath } from './tree/session-tree.js';
export { createTreeRenderer } from './tree/tree-renderer.js';
export { createSessionNavigator } from './navigation/session-navigation.js';
export { extractContent, filterNodes, getSearchableText, hasTextContent, recalculateVisualStructure } from './tree/session-filter.js';
export { escapeHtml, formatToolCall, getTreeNodeDisplayHtml, shortenPath, truncate } from './render/session-format.js';

export const sessionEntrypointLoaded = true;

export function applyLazyHighlighting(documentImpl) {
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
  configureSettingsSync({ fetchImpl: target.fetch ? target.fetch.bind(target) : undefined });
  hydrateSettings({ storage: target.localStorage });
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

  let artifactPanel = null;
  let annotationLayer = null;
  // Hide the Artifacts tab entirely when the feature is disabled; if it was the
  // active tab, fall back to Scratchpad so the user isn't left on a blank pane.
  function applyArtifactsEnabled(enabled) {
    const tab = documentImpl.getElementById('right-tab-artifacts');
    if (!tab) return;
    tab.hidden = !enabled;
    if (!enabled && tab.classList.contains('active')) {
      documentImpl.getElementById('right-tab-scratchpad')?.click();
    }
  }
  function refreshArtifacts() {
    if (!artifactPanel) return;
    const all = collectArtifacts(dataModel.entries);
    const settings = readArtifactSettings(target.localStorage);
    applyArtifactsEnabled(settings.enabled);
    const { visible, hiddenCount } = filterArtifacts(all, settings);
    artifactPanel.setArtifacts(visible, { hiddenCount });
    const countEl = documentImpl.getElementById('artifact-tab-count');
    if (countEl) {
      countEl.textContent = String(visible.length);
      countEl.hidden = visible.length === 0;
    }
  }

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
        if (dataModel.entries[i]?.id && dataModel.entries[i]?.type !== 'label') {
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

    refreshArtifacts();
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

  // Artifacts panel (right-sidebar "Artifacts" tab). Live-only: the host element
  // is rendered only when IsLive, so this is a no-op on export snapshots.
  const artifactHost = documentImpl.getElementById('artifact-panel-host');
  if (artifactHost) {
    let artifactHljs = null;
    const artifactHighlight = (code, lang) => {
      if (!artifactHljs) return null;
      try {
        return lang && artifactHljs.getLanguage(lang)
          ? artifactHljs.highlight(code, { language: lang }).value
          : artifactHljs.highlightAuto(code).value;
      } catch { return null; }
    };
    artifactPanel = createArtifactPanel({
      host: artifactHost,
      escapeHtml: sessionFormat.escapeHtml,
      highlight: artifactHighlight,
      renderMarkdown: (text) => safeMarkedParse(text, { marked }),
      documentImpl,
      windowImpl: target,
      navigatorImpl: target.navigator,
      URLImpl: target.URL,
      BlobImpl: target.Blob
    });
    refreshArtifacts();
    import('highlight.js').then(({ default: loaded }) => {
      artifactHljs = loaded;
      artifactPanel.render();
    });

    // Reflect artifact-setting changes made on the /settings page (in another
    // tab) without a reload. The `storage` event fires only in other documents,
    // so this won't double-fire for changes originating in this same tab. A null
    // key means storage was cleared — refresh to re-read defaults.
    target.addEventListener('storage', (e) => {
      if (e.key === null || ARTIFACT_SETTING_KEYS.includes(e.key)) refreshArtifacts();
    });

    // Artifacts help (?) modal — shown only on the Artifacts tab via CSS.
    const helpBtn = documentImpl.getElementById('artifact-help-btn');
    const helpModal = documentImpl.getElementById('artifact-help-modal');
    if (helpBtn && helpModal) {
      const hideHelp = () => { helpModal.hidden = true; };
      helpBtn.addEventListener('click', () => { helpModal.hidden = false; });
      helpModal.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="close-artifact-help"]')) hideHelp();
      });
      target.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !helpModal.hidden) hideHelp();
      });
    }
  }

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
      btn.innerHTML = icon(Loader, { size: 13, class: 'spinner' });
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
        .catch(() => {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
          target.alert('Fork failed');
        });
    },
    onLabel: (entryId) => {
      openLabelModal({
        entryId,
        currentLabel: dataModel.labelMap.get(entryId) || '',
        documentImpl,
        onSave: ({ entryId: id, label }) => {
          target.fetch(`/api/label-session?id=${encodeURIComponent(sessionId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId: id, label }),
          })
            .then(async (res) => {
              const data = await res.json().catch(() => ({}));
              if (!res.ok || data.error) throw new Error(data.error || t('session.labelSaveFailed'));
              if (label) dataModel.labelMap.set(id, label);
              else dataModel.labelMap.delete(id);
              forceTreeRerender();
            })
            .catch((err) => target.alert(err?.message || t('session.labelSaveFailed')));
        }
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

  // Annotation layer (right-sidebar "Notes" tab). Live-only: the host element is
  // rendered only when IsLive. Anchors to entries by `entry-<id>` + offsets.
  const annotationListHost = documentImpl.getElementById('annotation-list-host');
  const messagesEl = documentImpl.getElementById('messages');
  if (annotationListHost && messagesEl && sessionId) {
    const annotationArtifactHost = documentImpl.getElementById('artifact-panel-host');
    annotationLayer = createAnnotationLayer({
      sessionId,
      api: createAnnotationApi({ sessionId, fetchImpl: target.fetch.bind(target) }),
      scopes: [messagesEl, annotationArtifactHost].filter(Boolean),
      listHost: annotationListHost,
      composerEl: documentImpl.getElementById('pi-chat-message'),
      countEl: documentImpl.getElementById('annotation-tab-count'),
      escapeHtml: sessionFormat.escapeHtml,
      onSelectArtifact: (artifactId) => {
        ui.activateRightTab('artifacts');
        artifactPanel?.selectArtifact(artifactId);
      },
      onCreate: () => {
        ui.openRightSidebar();
        ui.activateRightTab('notes');
      },
      onSend: () => {
        // On mobile the sidebar is a full-screen overlay; collapse it so the
        // composer it just filled is visible and ready to type into.
        if (ui.isMobileLayout()) ui.collapseRightSidebar();
      },
      onAddToChat: (attachment) => {
        target.dispatchEvent(new target.CustomEvent('pi-chat-attach-text', { detail: attachment }));
        if (ui.isMobileLayout()) ui.collapseRightSidebar();
      },
      resolveArtifact: (artifactId) => artifactPanel?.getArtifact(artifactId) || null,
      documentImpl,
      windowImpl: target
    });
    annotationLayer.init();
    target.addEventListener('pi-session-reload', () => annotationLayer.reapply());
  }

  setupImageModal({ documentImpl });

  doneNotifier.setupDoneNotifyToggle({ documentImpl, windowImpl: target });
  doneNotifier.setupAppBadgeClearing({ documentImpl, windowImpl: target });
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
    chatPreview,
    shareOverlay,
    resumeButton,
    newSessionButton,
    cwd: dataModel.header?.cwd || '',
    onSessionDataReload: (data) => syncDataModelEntries(data.entries),
    onAnnotations: (list) => annotationLayer?.setAnnotations(list)
  });

  setupKeyboardNav({ windowImpl: target, documentImpl });

  createVersionController({ documentImpl, windowImpl: target });

  // Cat Gatekeeper — focus/break + bedtime companion. Self-paced background
  // timer; settings open from the command menu (data-action="cat-gatekeeper").
  target.__piCatGatekeeper = setupCatGatekeeper({ documentImpl, windowImpl: target }).start();

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

  const newSessionHeaderBtn = documentImpl.getElementById('new-session-header-btn');
  if (newSessionHeaderBtn) {
    newSessionHeaderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      documentImpl.getElementById('new-btn')?.click();
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
    slashSelector,
    mentionSelector,
    FormDataImpl: target.FormData,
    URLSearchParamsImpl: target.URLSearchParams,
    CustomEventImpl: target.CustomEvent,
    setIntervalImpl: target.setInterval.bind(target)
  });

  setupGitFooter({
    documentImpl,
    windowImpl: target,
    sessionId: getSessionSearchParams({ documentImpl, windowImpl: target }).get('id') || '',
    gitApi
  });

  setupBtwPopup({
    documentImpl,
    windowImpl: target,
    cwd: dataModel.header?.cwd || '',
    parentId: getSessionSearchParams({ documentImpl, windowImpl: target }).get('id') || '',
  });

  // For huge sessions the server embeds only the tail entries in the initial
  // HTML render. Wire a "Load earlier" banner that fetches preceding windows
  // via /api/session?id=...&from=N&count=K and merges them into the model.
  // No-ops on small sessions (dataModel.truncated is false).
  setupLoadEarlierBanner({
    dataModel,
    sessionId,
    syncDataModelEntries,
    // Re-render the conversation from the current leaf so the prepended earlier
    // entries actually appear in #messages, keeping the viewport anchored on the
    // message that was previously at the top (anchorId) to avoid a scroll jump.
    rerender: (anchorId) => navigateTo(dataModel.leafId, anchorId ? 'target' : 'bottom', anchorId || null),
    documentImpl,
    fetchImpl: target.fetch.bind(target),
  });

  // Handle Visual Viewport changes to prevent mobile browsers from shifting
  // the top fixed header out of view when the virtual keyboard is open.
  if (target.visualViewport) {
    const handleVisualViewportChange = () => {
      const height = target.visualViewport.height;
      documentImpl.documentElement.style.setProperty('--viewport-height', `${height}px`);

      // Dynamically adjust the top header's vertical position to offset
      // layout viewport scroll/shift caused by mobile virtual keyboard.
      const offsetTop = Math.max(0, target.visualViewport.offsetTop);
      const header = documentImpl.querySelector('.session-header-bar');
      if (header) {
        header.style.transform = `translateY(${offsetTop}px)`;
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

