import { marked } from 'marked';
import { icon, Loader } from '../shared/icons.js';

import { buildSessionLookups, loadSessionData, getSessionSearchParams } from './data/session-data.js';
import { buildTree as buildTreeForModel, buildTreeNodeMap, findNewestLeaf as findNewestLeafInTree } from './tree/session-tree.js';
import { extractContent, filterNodes as filterNodesForState, getSearchableText, hasTextContent, recalculateVisualStructure } from './tree/session-filter.js';
import { escapeHtml, formatToolCall, getTreeNodeDisplayHtml as getTreeNodeDisplayHtmlForState, shortenPath, truncate } from './render/session-format.js';
import { configureSessionMarkdown, safeMarkedParse } from './render/markdown.js';
import * as sessionEntryRenderer from './render/session-entry-renderer.js';
import * as toggleStateApi from './ui/toggle-state.js';
import * as sidebarApi from './ui/sidebar.js';
import * as searchFiltersApi from './ui/search-filters.js';
import { setupSessionUi } from './ui/session-ui-runner.js';
import { collectArtifacts } from './artifacts/artifact-registry.js';
import { filterArtifacts, readArtifactSettings, ARTIFACT_SETTING_KEYS } from './artifacts/artifact-filter.js';
import { createAnnotationApi } from './annotations/annotation-api.js';
import { setupLoadEarlierBanner } from './ui/load-earlier.js';
import * as doneNotifier from './chat/done-notifier.js';
// Chat composer + git footer → <ChatComposer>; live reload (SSE) → <LiveReload>.
// share-overlay → <ShareDialog>. All rendered by SessionPage.
import { createVersionController } from '../shared/version.js';
import { setupKeyboardNav } from '../shared/keyboard-nav.js';
import { toggleTheme, syncThemeIcons } from '../shared/theme.js';
import { setupSessionListPalette } from '../shared/session-list-palette.js';
import { configureSettingsSync, hydrateSettings } from '../shared/settings-store.js';
import { t } from '../shared/i18n.js';
export { buildSessionLookups, createSessionDataModel, decodeBase64JSON, getSessionSearchParams, loadSessionData, readSessionPayload } from './data/session-data.js';
export { buildActivePathIds, buildTree, buildTreeNodeMap, buildTreePrefix, findNewestLeaf, flattenTree, getPath } from './tree/session-tree.js';
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
  // The reactive SessionDataModel initializes these; the plain fallback model
  // (loadSessionData) doesn't, so seed them from leafId/urlTargetId.
  if (dataModel.currentLeafId == null) dataModel.currentLeafId = dataModel.leafId;
  if (dataModel.currentTargetId == null) dataModel.currentTargetId = dataModel.urlTargetId || dataModel.leafId;
  const sessionId = getSessionSearchParams(target.location).get('id') || '';
  const hljs = null; // loaded lazily after initial render via applyLazyHighlighting

  // View state (active leaf/target, filter, search) lives on the reactive
  // SessionDataModel — the single source of truth. navigateTo (owned by
  // SessionPage) writes the model; the Svelte tree/content recompute reactively.

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

  let annotationLayer = null;
  // The artifacts panel is the <ArtifactPanel> Svelte component (rendered inside
  // <RightSidebar>); it exposes its imperative API on window.__piArtifactPanel.
  // session.js still owns artifact collection/filtering and pushes the visible
  // set into the component.
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
    if (!target.__piArtifactPanel) return;
    const all = collectArtifacts(dataModel.entries);
    const settings = readArtifactSettings(target.localStorage);
    applyArtifactsEnabled(settings.enabled);
    const { visible, hiddenCount } = filterArtifacts(all, settings);
    target.__piArtifactPanel.setArtifacts(visible, { hiddenCount });
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
    const currentLeafId = dataModel.currentLeafId;
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
      dataModel.currentLeafId = nextLeafId;
      if (!dataModel.currentTargetId) dataModel.currentTargetId = nextLeafId;
    }

    // Live reload reconciles the data model when the session JSONL changes.
    // The in-place entries splice + map refills above are reactive, so the
    // Svelte <SessionTreeNodes> sidebar + <SessionContent> update automatically.
    refreshArtifacts();
  }

  const entryRenderer = sessionEntryRenderer.createSessionEntryRenderer({
    entries: dataModel.entries,
    header: dataModel.header,
    toolCallMap: dataModel.toolCallMap,
    renderedTools: dataModel.renderedTools,
    currentLeafIdRef: () => dataModel.currentLeafId,
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
    setSearchQuery: (value) => { dataModel.searchQuery = value; },
    setFilterMode: (value) => { dataModel.filterMode = value; },
    // The reactive model recomputes filteredNodes; no manual rerender needed.
    forceTreeRerender: () => {},
    navigateTo: (...args) => navigateTo(...args),
  });

  // Artifacts panel (right-sidebar "Artifacts" tab). Live-only: the
  // <ArtifactPanel> component (and its window bridge) exists only when IsLive,
  // so this is a no-op on export snapshots.
  const artifactHost = documentImpl.getElementById('artifact-panel-host');
  if (artifactHost) {
    refreshArtifacts();

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

  // navigateTo is owned by SessionPage (created from the reactive model) and
  // exposed on window; the tree/chat/live components share this one instance.
  const navigateTo = target.navigateTo;

  // Copy/fork/label are handled by ONE delegated click listener on #messages
  // (wired below) rather than per-entry bindings, because <SessionContent>
  // renders and reactively re-renders the message DOM.
  const forkEntry = (entryId, btn) => {
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
  };

  const labelEntry = (entryId) => {
    // The label modal is the <LabelModal> Svelte component; SessionPage exposes
    // the opener. session.js still owns the save (API + tree refresh).
    target.__piOpenLabelModal?.({
      entryId,
      currentLabel: dataModel.labelMap.get(entryId) || '',
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
          })
          .catch((err) => target.alert(err?.message || t('session.labelSaveFailed')));
      }
    });
  };

  // Wire the reactive message pane: <SessionContent> (mounted by SessionPage in
  // #messages) renders model.activePath via the injected renderEntry, and runs
  // afterRender(container) after each (re)render to (re)apply toggle state and
  // lazy code highlighting. Assigning onto the shared $state runtime makes the
  // entries paint as soon as renderEntry is available.
  const contentRuntime = target.__piContentRuntime;
  if (contentRuntime) {
    contentRuntime.renderEntry = entryRenderer.renderEntry;
    contentRuntime.afterRender = (container) => {
      target.applyToggleStateToNode?.(container);
      applyLazyHighlighting(documentImpl);
    };
  }

  // Single delegated handler for the per-entry copy/fork/label buttons rendered
  // inside #messages by renderEntry. One binding survives reactive re-renders.
  const messagesElForButtons = documentImpl.getElementById('messages');
  messagesElForButtons?.addEventListener('click', (e) => {
    const copyBtn = e.target.closest?.('.copy-link-btn');
    if (copyBtn) {
      e.stopPropagation();
      entryRenderer.copyToClipboard(entryRenderer.buildShareUrl(copyBtn.dataset.entryId), copyBtn);
      return;
    }
    const forkBtn = e.target.closest?.('.fork-btn');
    if (forkBtn) {
      e.stopPropagation();
      forkEntry(forkBtn.dataset.entryId, forkBtn);
      return;
    }
    const labelBtn = e.target.closest?.('.label-btn');
    if (labelBtn) {
      e.stopPropagation();
      labelEntry(labelBtn.dataset.entryId);
    }
  });

  // Exposed for <SessionTree>'s node-click handler so it can auto-close the
  // mobile drawer (parity with the old tree renderer).
  target.__piIsMobileLayout = ui.isMobileLayout;
  target.__piCloseSidebar = ui.closeSidebar;

  // The header card is now a persistent Svelte component (<SessionInfoHeader>),
  // not re-rendered per navigation, so bind its toggle buttons exactly once.
  ui.attachHeaderHandlers();

  // Replace the server-rendered first-message LCP stub with the canonical
  // active path before live reload starts. Otherwise reload appends canonical
  // entries below the stub and the conversation appears duplicated.
  navigateTo(dataModel.currentLeafId, dataModel.urlTargetId ? 'target' : 'bottom', dataModel.urlTargetId || null);

  // Annotation layer (right-sidebar "Notes" tab) is the <AnnotationLayer> Svelte
  // component (rendered inside <RightSidebar>), exposing init/setAnnotations/
  // reapply on window.__piAnnotationLayer. Live-only: the component (and bridge)
  // exist only when IsLive. session.js supplies the runtime deps here. Anchors to
  // entries by `entry-<id>` + offsets.
  annotationLayer = target.__piAnnotationLayer || null;
  const messagesEl = documentImpl.getElementById('messages');
  if (annotationLayer && messagesEl && sessionId) {
    const annotationArtifactHost = documentImpl.getElementById('artifact-panel-host');
    annotationLayer.init({
      api: createAnnotationApi({ sessionId, fetchImpl: target.fetch.bind(target) }),
      scopes: [messagesEl, annotationArtifactHost].filter(Boolean),
      composerEl: documentImpl.getElementById('pi-chat-message'),
      countEl: documentImpl.getElementById('annotation-tab-count'),
      onSelectArtifact: (artifactId) => {
        ui.activateRightTab('artifacts');
        target.__piArtifactPanel?.selectArtifact(artifactId);
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
      resolveArtifact: (artifactId) => target.__piArtifactPanel?.getArtifact(artifactId) || null,
    });
    target.addEventListener('pi-session-reload', () => annotationLayer.reapply());
  }

  // Image click-to-zoom is now the <ImageModal> Svelte component (rendered by
  // SessionPage); no imperative setup needed here.

  doneNotifier.setupDoneNotifyToggle({ documentImpl, windowImpl: target });
  doneNotifier.setupAppBadgeClearing({ documentImpl, windowImpl: target });
  target.addEventListener('pi-worker-done', () => {
    doneNotifier.notifyDone({ documentImpl, windowImpl: target });
  });

  // Live reload (SSE) is the <LiveReload> Svelte component (rendered by
  // SessionPage); it self-inits in onMount. session.js still owns model
  // reconciliation (shared with load-earlier), exposed here for <LiveReload>'s
  // onSessionDataReload to call when the JSONL changes.
  target.__piReconcileEntries = (entries) => syncDataModelEntries(entries);

  setupKeyboardNav({ windowImpl: target, documentImpl });

  createVersionController({ documentImpl, windowImpl: target });

  // Cat Gatekeeper (focus/break + bedtime companion) is the <CatGatekeeper>
  // Svelte component (rendered by SessionPage); it wires its controller +
  // overlay in onMount and exposes it on window.__piCatGatekeeper.

  // The session actions menu is the <CommandMenu> Svelte component (rendered by
  // SessionPage); it wires its own behavior in onMount.

  // Set up session list palette (Cmd+K / "List Sessions" menu item). Exposed on
  // window so <CommandMenu>'s list-sessions action and the Cmd+K shortcut below
  // can open it without a direct reference.
  const sessionPalette = setupSessionListPalette({
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
  target.__piOpenSessionPalette = () => sessionPalette.open();

  // Cmd+K keyboard shortcut for session list palette
  target.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      target.__piOpenSessionPalette?.();
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

  // Cmd+/ keyboard shortcut to show keyboard shortcuts help modal. The modal is
  // the <ShortcutsModal> Svelte component; SessionPage exposes the opener.
  target.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      target.__piOpenShortcuts?.();
    }
  });

  const shortcutsBtn = documentImpl.getElementById('shortcuts-help-btn');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      target.__piOpenShortcuts?.();
    });
  }

  const newSessionHeaderBtn = documentImpl.getElementById('new-session-header-btn');
  if (newSessionHeaderBtn) {
    newSessionHeaderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      documentImpl.getElementById('new-btn')?.click();
    });
  }

  // The chat composer (+ git footer) is the <ChatComposer> Svelte component
  // (rendered by SessionPage); it self-inits in onMount. <LiveReload> mounts
  // first, so its optimistic "message sent" listener exists before the user can
  // submit.

  // The btw floating scratch-chat is the <BtwPopup> Svelte component (rendered
  // by SessionPage); it self-wires its #pi-btw-button trigger in onMount.

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

