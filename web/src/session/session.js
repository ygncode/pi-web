import { marked } from 'marked';
import { icon, Loader } from '../shared/icons.js';

import { loadSessionData, getSessionSearchParams } from './data/session-data.js';
import { extractContent, filterNodes as filterNodesForState, getSearchableText, hasTextContent, recalculateVisualStructure } from './tree/session-filter.js';
import { escapeHtml, formatToolCall, getTreeNodeDisplayHtml as getTreeNodeDisplayHtmlForState, shortenPath, truncate } from './render/session-format.js';
import { configureSessionMarkdown, safeMarkedParse } from './render/markdown.js';
import * as sessionEntryRenderer from './render/session-entry-renderer.js';
import * as toggleStateApi from './ui/toggle-state.js';
import * as sidebarApi from './ui/sidebar.js';
import * as searchFiltersApi from './ui/search-filters.js';
import { setupSessionUi } from './ui/session-ui-runner.js';
import { createAnnotationApi } from './annotations/annotation-api.js';
// Chat composer + git footer → <ChatComposer>; live reload (SSE) → <LiveReload>.
// share-overlay → <ShareDialog>. Page-global glue → setupSessionGlobals (called
// by SessionPage). All rendered/invoked by SessionPage.
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
  // <RightSidebar>); it collects/filters artifacts reactively from the shared
  // model and exposes selectArtifact/getArtifact on window.__piArtifactPanel for
  // the annotation layer.

  // Live reload + load-earlier reconcile the model via SessionDataModel.reconcile()
  // (in-place entries splice + lookup-map refills, all reactive), exposed by
  // SessionPage on window.__piReconcileEntries.

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

  // Artifacts (right-sidebar "Artifacts" tab) are collected reactively by the
  // <ArtifactPanel> Svelte component from the shared model; the help (?) modal +
  // cross-tab settings refresh live in <ArtifactPanel>/<RightSidebar>. Live-only:
  // those components exist only when IsLive, so nothing happens on export.

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

  // Page-global glue (done-notifier, keyboard shortcuts, version checker,
  // session-list palette, load-earlier, visual-viewport/scroll) lives in
  // setupSessionGlobals(), called by <SessionPage> after this. Cat gatekeeper,
  // command menu, chat composer, live reload, and btw are self-initializing
  // Svelte components rendered by SessionPage. Model reconciliation for
  // <LiveReload> + load-earlier is exposed on window.__piReconcileEntries
  // (set by SessionPage from model.reconcile).
}

