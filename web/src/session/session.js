import { marked } from 'marked';
import hljs from 'highlight.js';

import { loadSessionData } from './data/session-data.js';
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
import * as liveEvents from './live/live-events.js';
import * as liveRenderer from './live/live-renderer.js';
export { buildSessionLookups, createSessionDataModel, decodeBase64JSON, getSessionSearchParams, loadSessionData, readSessionPayload } from './data/session-data.js';
export { buildActivePathIds, buildTree, buildTreeNodeMap, buildTreePrefix, findNewestLeaf, flattenTree, getPath } from './tree/session-tree.js';
export { createTreeRenderer } from './tree/tree-renderer.js';
export { createSessionNavigator } from './navigation/session-navigation.js';
export { extractContent, filterNodes, getSearchableText, hasTextContent, recalculateVisualStructure } from './tree/session-filter.js';
export { escapeHtml, formatToolCall, getTreeNodeDisplayHtml, shortenPath, truncate } from './render/session-format.js';

export const sessionEntrypointLoaded = true;

export const sessionCompatibilitySources = [];
export const liveReloadSource = '';

export function runSessionApp({ target = window } = {}) {
  const documentImpl = target.document;
  target.marked = target.marked || marked;
  target.hljs = target.hljs || hljs;
  const dataModel = target.__piSessionDataModel || loadSessionData({
    documentImpl,
    windowImpl: target,
    atobImpl: target.atob?.bind(target)
  });
  target.__piSessionDataModel = dataModel;

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
    navigateTo: (...args) => navigateTo(...args)
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
    }
  });

  target.navigateTo = navigateTo;
  target.renderEntryToNode = renderEntryToNode;
  target.__piTreeRenderer = treeRenderer;
  target.__piSessionNavigator = navigatorInstance;

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
    resumeButton
  });
}


if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById('session-data')) {
  runSessionApp();
}
