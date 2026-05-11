export function setupSessionSearchAndFilters({
  documentImpl = document,
  getLeafId,
  setSearchQuery,
  setFilterMode,
  forceTreeRerender,
  navigateTo
} = {}) {
  const searchInput = documentImpl.getElementById('tree-search');
  searchInput?.addEventListener('input', (e) => {
    setSearchQuery(e.target.value);
    forceTreeRerender();
  });

  documentImpl.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      documentImpl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setFilterMode(btn.dataset.filter);
      forceTreeRerender();
    });
  });

  return {
    clearAndNavigateBottom() {
      if (searchInput) searchInput.value = '';
      setSearchQuery('');
      navigateTo(getLeafId(), 'bottom');
    }
  };
}

export function isEditableTarget(element) {
  if (!element) return false;
  const tagName = element.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON') {
    return true;
  }
  return element.isContentEditable || Boolean(element.closest?.('[contenteditable="true"]'));
}

export function setupSessionKeyboardShortcuts({
  documentImpl = document,
  clearSearch,
  toggleThinking,
  toggleToolsVisibility,
  toggleToolOutputs,
  isEditableTargetImpl = isEditableTarget
} = {}) {
  documentImpl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSearch();
    }

    if (isEditableTargetImpl(documentImpl.activeElement)) {
      return;
    }

    const key = e.key.toLowerCase();
    if (key === 't') {
      e.preventDefault();
      toggleThinking();
    } else if (key === 'o') {
      e.preventDefault();
      toggleToolsVisibility();
    } else if (key === 'p') {
      e.preventDefault();
      toggleToolOutputs();
    }
  });
}
