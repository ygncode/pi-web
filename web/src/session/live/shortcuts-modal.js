/**
 * Keyboard Shortcuts Modal — displays all global and contextual shortcuts
 * inside a reusable fullscreen sheet, with real-time search filtering.
 */

import { showSheet } from './full-screen-sheet.js';

const SHORTCUTS = [
  {
    category: 'General',
    items: [
      { desc: 'Search sessions', keys: ['⌘', 'K'], keysWin: ['Ctrl', 'K'] },
      { desc: 'Toggle sidebar (tree)', keys: ['⌘', 'B'], keysWin: ['Ctrl', 'B'] },
      { desc: 'New session', keys: ['⌘', 'T'], keysWin: ['Ctrl', 'T'] },
      { desc: 'Toggle theme (dark/light)', keys: ['⌘', '⇧', 'L'], keysWin: ['Ctrl', 'Shift', 'L'] },
      { desc: 'Toggle shortcuts help', keys: ['⌘', '/'], keysWin: ['Ctrl', '/'] },
    ]
  },
  {
    category: 'Chat Composer',
    items: [
      { desc: 'Focus chat input', keys: ['⇧', 'I'], keysWin: ['Shift', 'I'], note: 'Outside input' },
      { desc: 'Cycle thinking mode', keys: ['⇧', '⇥'], keysWin: ['Shift', 'Tab'], note: 'Inside input' },
      { desc: 'Choose/switch model', keys: ['⌃', 'I'], keysWin: ['Ctrl', 'I'], note: 'Inside input' },
      { desc: 'Submit message', keys: ['↩'], keysWin: ['Enter'], note: 'Inside input' },
    ]
  },
  {
    category: 'Vim Navigation',
    note: 'When chat input is not active',
    items: [
      { desc: 'Scroll down', keys: ['J'], keysWin: ['J'] },
      { desc: 'Scroll up', keys: ['K'], keysWin: ['K'] },
      { desc: 'Scroll to top', keys: ['G', 'G'], keysWin: ['G', 'G'] },
      { desc: 'Scroll to bottom', keys: ['⇧', 'G'], keysWin: ['Shift', 'G'] },
    ]
  }
];

export function showShortcutsModal({
  documentImpl = document,
  windowImpl = window,
} = {}) {
  const isMac = windowImpl.navigator?.platform?.toUpperCase().indexOf('MAC') >= 0;

  const sheet = showSheet({
    title: 'Keyboard shortcuts',
    showBack: true,
    showClose: false,
    closeOnEscape: true,
    closeOnBackdrop: true,
    documentImpl,
    windowImpl,
    renderBody: ({ close, bodyEl }) => {
      bodyEl.classList.add('shortcuts-sheet-body');
      const panel = bodyEl.closest?.('.pi-sheet-panel');
      panel?.classList.add('shortcuts-sheet-panel');
      panel?.closest?.('.pi-sheet-backdrop')?.classList.add('shortcuts-sheet-backdrop');

      const container = documentImpl.createElement('div');
      container.className = 'shortcuts-palette';

      const searchWrap = documentImpl.createElement('div');
      searchWrap.className = 'shortcuts-search-wrap';

      const search = documentImpl.createElement('input');
      search.className = 'shortcuts-search-input';
      search.type = 'search';
      search.placeholder = 'Search shortcuts...';
      search.autocomplete = 'off';
      search.spellcheck = false;
      search.setAttribute('aria-label', 'Search keyboard shortcuts');
      searchWrap.appendChild(search);

      const content = documentImpl.createElement('div');
      content.className = 'shortcuts-palette-content';

      container.appendChild(searchWrap);
      container.appendChild(content);

      function renderList(filterText = '') {
        const query = filterText.toLowerCase().trim();
        let html = '';
        let matchCount = 0;

        SHORTCUTS.forEach((cat) => {
          const matchedItems = cat.items.filter((item) => {
            return item.desc.toLowerCase().indexOf(query) >= 0 ||
                   cat.category.toLowerCase().indexOf(query) >= 0;
          });

          if (matchedItems.length === 0) return;

          matchCount += matchedItems.length;

          html += `
            <div class="shortcuts-group">
              <div class="shortcuts-group-title">
                ${cat.category}
                ${cat.note ? `<span class="shortcuts-group-note">${cat.note}</span>` : ''}
              </div>
              <div class="shortcuts-list">
                ${matchedItems.map((item) => {
                  const displayKeys = isMac ? item.keys : (item.keysWin || item.keys);
                  const keysHtml = displayKeys.map(k => `<kbd class="shortcuts-kbd">${k}</kbd>`).join(' ');
                  return `
                    <div class="shortcuts-item">
                      <div class="shortcuts-item-desc">
                        ${item.desc}
                        ${item.note ? `<span class="shortcuts-item-note">${item.note}</span>` : ''}
                      </div>
                      <div class="shortcuts-item-keys">${keysHtml}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        });

        if (matchCount === 0) {
          content.innerHTML = `<div class="shortcuts-empty-state">No matching shortcuts found</div>`;
        } else {
          content.innerHTML = html;
        }
      }

      search.addEventListener('input', (e) => {
        renderList(e.target.value);
      });

      // Close on clicking outside search or list
      container.addEventListener('click', (e) => {
        if (e.target === container) {
          close();
        }
      });

      renderList();

      // Focus search initially
      windowImpl.setTimeout(() => {
        search.focus();
      }, 50);

      return container;
    }
  });

  return sheet;
}
