/**
 * Fork Palette — shows user messages from the current session so the user
 * can pick one to fork a new session from.
 */

import { showSheet } from './full-screen-sheet.js';

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function truncateText(text, maxLength = 96) {
  const normalized = normalizeText(text);
  if (!normalized) return '(empty)';
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).trimEnd() + '…';
}

function extractUserMessageText(entry) {
  if (entry?.type !== 'message') return '';
  const msg = entry.message;
  if (!msg || msg.role !== 'user') return '';
  const content = msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b?.type === 'text')
      .map((b) => b.text)
      .join(' ');
  }
  return '';
}

function buildUserMessageList(entries = []) {
  const messages = [];
  for (const entry of entries) {
    const text = normalizeText(extractUserMessageText(entry));
    if (text) {
      messages.push({ entryId: entry.id, text, number: messages.length + 1 });
    }
  }
  return messages.reverse();
}

function createEmptyState(documentImpl) {
  const empty = documentImpl.createElement('div');
  empty.className = 'fork-empty-state';
  empty.textContent = 'No matching messages';
  return empty;
}

export function showForkModal({
  entries = [],
  escapeHtml = String,
  documentImpl = document,
  windowImpl = window,
  onSelect = null,
} = {}) {
  void escapeHtml;
  const userMessages = buildUserMessageList(entries);
  if (userMessages.length === 0) {
    return null;
  }

  const sheet = showSheet({
    title: 'Fork from message',
    showBack: true,
    showClose: false,
    closeOnEscape: true,
    closeOnBackdrop: true,
    documentImpl,
    windowImpl,
    renderBody: ({ close, bodyEl }) => {
      bodyEl.classList.add('fork-sheet-body');
      const panel = bodyEl.closest?.('.pi-sheet-panel');
      panel?.classList.add('fork-sheet-panel');
      panel?.closest?.('.pi-sheet-backdrop')?.classList.add('fork-sheet-backdrop');

      let filteredMessages = [...userMessages];
      let selectedIndex = 0;
      const rowButtons = new Map();

      const container = documentImpl.createElement('div');
      container.className = 'fork-palette';

      const searchWrap = documentImpl.createElement('div');
      searchWrap.className = 'fork-search-wrap';

      const search = documentImpl.createElement('input');
      search.className = 'fork-search-input';
      search.type = 'search';
      search.placeholder = 'Search messages...';
      search.autocomplete = 'off';
      search.spellcheck = false;
      search.setAttribute('aria-label', 'Search messages to fork from');
      searchWrap.appendChild(search);

      const content = documentImpl.createElement('div');
      content.className = 'fork-palette-content';

      const list = documentImpl.createElement('div');
      list.className = 'fork-message-list';
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', 'Messages');

      const preview = documentImpl.createElement('aside');
      preview.className = 'fork-message-preview';
      preview.setAttribute('aria-live', 'polite');

      const footer = documentImpl.createElement('div');
      footer.className = 'fork-palette-footer';
      footer.textContent = '↑↓ navigate • enter select • esc close';

      function selectMessage(msg) {
        close();
        if (onSelect) onSelect(msg.entryId);
      }

      function updatePreview(msg) {
        preview.innerHTML = '';
        if (!msg) {
          preview.appendChild(createEmptyState(documentImpl));
          return;
        }

        const meta = documentImpl.createElement('div');
        meta.className = 'fork-preview-meta';
        meta.textContent = `#${msg.number}`;

        const title = documentImpl.createElement('div');
        title.className = 'fork-preview-title';
        title.textContent = truncateText(msg.text, 80);

        const body = documentImpl.createElement('div');
        body.className = 'fork-preview-body';
        body.textContent = msg.text;

        preview.appendChild(meta);
        preview.appendChild(title);
        preview.appendChild(body);
      }

      function setSelected(nextIndex, { focus = false } = {}) {
        if (filteredMessages.length === 0) {
          selectedIndex = 0;
          updatePreview(null);
          return;
        }
        selectedIndex = Math.max(0, Math.min(nextIndex, filteredMessages.length - 1));
        const selectedMsg = filteredMessages[selectedIndex];
        rowButtons.forEach((btn, entryId) => {
          const active = entryId === selectedMsg.entryId;
          btn.classList.toggle('is-selected', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        updatePreview(selectedMsg);
        if (focus) rowButtons.get(selectedMsg.entryId)?.focus();
      }

      function renderList() {
        rowButtons.clear();
        list.innerHTML = '';
        if (filteredMessages.length === 0) {
          list.appendChild(createEmptyState(documentImpl));
          updatePreview(null);
          return;
        }

        filteredMessages.forEach((msg, index) => {
          const btn = documentImpl.createElement('button');
          btn.className = 'fork-message-item';
          btn.type = 'button';
          btn.setAttribute('role', 'option');

          const numberSpan = documentImpl.createElement('span');
          numberSpan.className = 'fork-message-number';
          numberSpan.textContent = `#${msg.number}`;

          const textSpan = documentImpl.createElement('span');
          textSpan.className = 'fork-message-text';
          textSpan.textContent = truncateText(msg.text);

          btn.appendChild(textSpan);
          btn.appendChild(numberSpan);

          btn.addEventListener('mouseenter', () => setSelected(index));
          btn.addEventListener('focus', () => setSelected(index));
          btn.addEventListener('click', () => selectMessage(msg));

          rowButtons.set(msg.entryId, btn);
          list.appendChild(btn);
        });

        setSelected(Math.min(selectedIndex, filteredMessages.length - 1));
      }

      function applyFilter() {
        const query = normalizeText(search.value).toLowerCase();
        filteredMessages = query
          ? userMessages.filter((msg) => msg.text.toLowerCase().includes(query) || String(msg.number).includes(query.replace(/^#/, '')))
          : [...userMessages];
        selectedIndex = 0;
        renderList();
      }

      search.addEventListener('input', applyFilter);
      search.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelected(selectedIndex + 1, { focus: false });
          rowButtons.get(filteredMessages[selectedIndex]?.entryId)?.scrollIntoView?.({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelected(selectedIndex - 1, { focus: false });
          rowButtons.get(filteredMessages[selectedIndex]?.entryId)?.scrollIntoView?.({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const msg = filteredMessages[selectedIndex];
          if (msg) selectMessage(msg);
        }
      });

      list.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelected(selectedIndex + 1, { focus: true });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelected(selectedIndex - 1, { focus: true });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const msg = filteredMessages[selectedIndex];
          if (msg) selectMessage(msg);
        }
      });

      renderList();
      content.appendChild(list);
      content.appendChild(preview);
      container.appendChild(searchWrap);
      container.appendChild(content);
      container.appendChild(footer);

      const requestFrame = windowImpl?.requestAnimationFrame?.bind(windowImpl) ?? ((fn) => windowImpl.setTimeout?.(fn, 0));
      requestFrame(() => requestFrame(() => search.focus()));

      return container;
    },
  });

  return sheet;
}
