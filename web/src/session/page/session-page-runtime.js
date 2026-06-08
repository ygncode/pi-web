import { marked } from 'marked';
import { wireSessionContentRuntime } from '../session-content-runtime.js';
import { setupSessionGlobals } from '../session-globals.js';
import { sessionRuntime } from '../session-runtime.js';
import { configureSessionMarkdown, safeMarkedParse } from '../render/markdown.js';
import { setupSessionUi } from '../ui/session-ui-runner.js';
import * as sidebarApi from '../ui/sidebar.js';
import * as searchFiltersApi from '../ui/search-filters.js';
import * as toggleStateApi from '../ui/toggle-state.js';
import { configureSettingsSync, hydrateSettings } from '../../shared/settings-store.js';
import { getSessionRuntime } from '../session-runtime-context.js';
import { setupSessionAnnotations } from './session-page-annotations.js';

export function startSessionPageRuntime({
  sessionId,
  applyLazyHighlighting,
  windowImpl = window,
  documentImpl = document,
  runtime = getSessionRuntime(),
} = {}) {
  const model = runtime.model;
  const navigateTo = runtime.navigateTo;

  configureSettingsSync({ fetchImpl: windowImpl.fetch ? windowImpl.fetch.bind(windowImpl) : undefined });
  hydrateSettings({ storage: windowImpl.localStorage });
  windowImpl.marked = windowImpl.marked || marked;

  const contentWiring = wireSessionContentRuntime({
    windowImpl,
    documentImpl,
    model,
    sessionId,
    contentRuntime: runtime.contentRuntime,
    applyLazyHighlighting,
  });
  const { sessionFormat } = contentWiring;

  const ui = setupSessionUi({
    documentImpl,
    windowImpl,
    storage: windowImpl.localStorage,
    marked,
    hljs: null,
    escapeHtml: sessionFormat.escapeHtml,
    markdownApi: { configureSessionMarkdown, safeMarkedParse },
    searchFiltersApi,
    sidebarApi,
    toggleStateApi,
    getLeafId: () => model.leafId,
    setSearchQuery: (value) => { model.searchQuery = value; },
    setFilterMode: (value) => { model.filterMode = value; },
    forceTreeRerender: () => {},
    navigateTo,
  });

  sessionRuntime.layout = { isMobileLayout: ui.isMobileLayout, closeSidebar: ui.closeSidebar };
  ui.attachHeaderHandlers();
  navigateTo(model.currentLeafId, model.urlTargetId ? 'target' : 'bottom', model.urlTargetId || null);

  const disposeAnnotations = setupSessionAnnotations({ sessionId, ui, windowImpl, documentImpl });
  const disposeGlobals = setupSessionGlobals({
    windowImpl,
    documentImpl,
    model,
    sessionId,
    navigateTo,
  });

  return () => {
    disposeGlobals?.();
    disposeAnnotations?.();
    contentWiring.dispose?.();
  };
}
