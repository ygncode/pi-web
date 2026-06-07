export function setupSessionUi({
  documentImpl = document,
  windowImpl = window,
  storage = localStorage,
  marked,
  hljs,
  escapeHtml,
  markdownApi,
  searchFiltersApi,
  sidebarApi,
  toggleStateApi,
  getLeafId,
  setSearchQuery,
  setFilterMode,
  forceTreeRerender,
  navigateTo,
} = {}) {
  markdownApi.configureSessionMarkdown({ marked, hljs, escapeHtml });
  const safeMarkedParse = (text) => markdownApi.safeMarkedParse(text, { marked });

  const searchFilterControls = searchFiltersApi.setupSessionSearchAndFilters({
    documentImpl,
    getLeafId,
    setSearchQuery,
    setFilterMode,
    forceTreeRerender,
    navigateTo
  });

  const isMobileLayout = () => sidebarApi.isMobileLayout({ windowImpl });
  sidebarApi.setupSidebarResize({ documentImpl, windowImpl, storage });
  sidebarApi.setupSidebarCollapse({ documentImpl, windowImpl, storage });
  const closeSidebar = () => sidebarApi.setSidebarOpen(false, { documentImpl });
  const overlayEl = documentImpl.getElementById('sidebar-overlay');
  if (overlayEl) {
    overlayEl.addEventListener('click', closeSidebar);
    overlayEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      closeSidebar();
    }, { passive: false });
  }

  const toggleController = toggleStateApi.createToggleController({ documentImpl, storage });
  windowImpl.sessionToggleState = toggleController;
  windowImpl.applyToggleStateToNode = (node) => toggleController.applyToNode(node);

  const attachHeaderHandlers = () => toggleController.attachHeaderHandlers();
  const toggleThinking = () => toggleController.toggleThinking();
  const toggleToolsVisibility = () => toggleController.toggleToolsVisibility();
  const toggleToolOutputs = () => toggleController.toggleToolOutputs();

  searchFiltersApi.setupSessionKeyboardShortcuts({
    documentImpl,
    clearSearch: () => searchFilterControls.clearAndNavigateBottom(),
    toggleThinking,
    toggleToolsVisibility,
    toggleToolOutputs
  });

  return {
    safeMarkedParse,
    isMobileLayout,
    closeSidebar,
    attachHeaderHandlers,
    toggleController,
    // The right-sidebar chrome (scratchpad/resize/tabs) lives in <RightSidebar>,
    // which exposes its controls on window.__piRightSidebar. Read lazily so the
    // calls resolve against the mounted component.
    toggleRightSidebar: () => windowImpl.__piRightSidebar?.toggle(),
    openRightSidebar: () => windowImpl.__piRightSidebar?.open(),
    collapseRightSidebar: () => windowImpl.__piRightSidebar?.collapse(),
    activateRightTab: (pane) => windowImpl.__piRightSidebar?.activateTab(pane),
  };
}
