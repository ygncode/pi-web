// ============================================================
// NAVIGATION
// ============================================================

// Cache for rendered entry DOM nodes
const entryCache = new Map();

function renderEntryToNode(entry) {
  // Check cache first
  if (entryCache.has(entry.id)) {
    return entryCache.get(entry.id).cloneNode(true);
  }

  // Render to HTML string, then parse to node
  const html = renderEntry(entry);
  if (!html) return null;

  const template = document.createElement('template');
  template.innerHTML = html;
  const node = template.content.firstElementChild;

  // Cache the node
  if (node) {
    entryCache.set(entry.id, node.cloneNode(true));
  }
  return node;
}

function navigateTo(targetId, scrollMode = 'target', scrollToEntryId = null) {
  currentLeafId = targetId;
  currentTargetId = scrollToEntryId || targetId;
  const path = getPath(targetId);

  renderTree();

  document.getElementById('header-container').innerHTML = renderHeader();
  attachHeaderHandlers();

  // Build messages using cached DOM nodes
  const messagesEl = document.getElementById('messages');
  const fragment = document.createDocumentFragment();

  for (const entry of path) {
    const node = renderEntryToNode(entry);
    if (node) {
      fragment.appendChild(node);
    }
  }

  messagesEl.innerHTML = '';
  messagesEl.appendChild(fragment);
  window.sessionToggleState?.applyToNode(messagesEl);

  // Attach click handlers for copy-link buttons
  messagesEl.querySelectorAll('.copy-link-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const entryId = btn.dataset.entryId;
      const shareUrl = buildShareUrl(entryId);
      copyToClipboard(shareUrl, btn);
    });
  });

  // Use setTimeout(0) to ensure DOM is fully laid out before scrolling
  setTimeout(() => {
    const content = document.getElementById('content');
    if (scrollMode === 'bottom') {
      content.scrollTop = content.scrollHeight;
    } else if (scrollMode === 'target') {
      // If scrollToEntryId is provided, scroll to that specific entry
      const scrollTargetId = scrollToEntryId || targetId;
      const targetEl = document.getElementById(`entry-${scrollTargetId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ block: 'center' });
        // Briefly highlight the target message
        if (scrollToEntryId) {
          targetEl.classList.add('highlight');
          setTimeout(() => targetEl.classList.remove('highlight'), 2000);
        }
      }
    }
  }, 0);
}
