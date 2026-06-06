export function createSessionNavigator({
  documentImpl = document,
  windowImpl = window,
  getPath,
  renderTree,
  renderHeader,
  attachHeaderHandlers = () => {},
  renderEntry,
  buildShareUrl,
  copyToClipboard,
  applyToggleStateToNode = (node) => windowImpl.sessionToggleState?.applyToNode(node),
  onNavigate = () => {},
  onFork = null,
  onLabel = null
} = {}) {
  const entryCache = new Map();

  function renderEntryToNode(entry) {
    if (entryCache.has(entry.id)) return entryCache.get(entry.id).cloneNode(true);
    const html = renderEntry(entry);
    if (!html) return null;
    const template = documentImpl.createElement('template');
    template.innerHTML = html;
    const node = template.content.firstElementChild;
    if (node) entryCache.set(entry.id, node.cloneNode(true));
    return node;
  }

  function navigateTo(targetId, scrollMode = 'target', scrollToEntryId = null) {
    onNavigate(targetId, scrollToEntryId || targetId);
    const path = getPath(targetId);
    renderTree();

    const header = documentImpl.getElementById('header-container');
    if (header) {
      header.innerHTML = renderHeader();
      attachHeaderHandlers();
    }

    const messagesEl = documentImpl.getElementById('messages');
    if (messagesEl) {
      const fragment = documentImpl.createDocumentFragment();
      for (const entry of path) {
        const node = renderEntryToNode(entry);
        if (node) fragment.appendChild(node);
      }
      messagesEl.innerHTML = '';
      messagesEl.appendChild(fragment);
      applyToggleStateToNode(messagesEl);

      messagesEl.querySelectorAll('.copy-link-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const entryId = btn.dataset.entryId;
          copyToClipboard(buildShareUrl(entryId), btn);
        });
      });

      messagesEl.querySelectorAll('.fork-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const entryId = btn.dataset.entryId;
          if (typeof onFork === 'function') {
            onFork(entryId, btn);
          }
        });
      });

      messagesEl.querySelectorAll('.label-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const entryId = btn.dataset.entryId;
          if (typeof onLabel === 'function') {
            onLabel(entryId, btn);
          }
        });
      });
    }

    setTimeout(() => {
      const content = documentImpl.getElementById('content');
      if (!content) return;
      if (scrollMode === 'bottom') {
        content.scrollTop = content.scrollHeight;
      } else if (scrollMode === 'target') {
        const scrollTargetId = scrollToEntryId || targetId;
        const targetEl = documentImpl.getElementById(`entry-${scrollTargetId}`);
        if (targetEl) {
          targetEl?.scrollIntoView?.({ block: 'center' });
          if (scrollToEntryId) {
            targetEl.classList.add('highlight');
            setTimeout(() => targetEl.classList.remove('highlight'), 2000);
          }
        }
      }
    }, 0);
  }

  return { navigateTo, renderEntryToNode, entryCache };
}
