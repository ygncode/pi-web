/**
 * Keyboard Shortcuts Modal — displays all global and contextual shortcuts
 * inside a reusable fullscreen sheet, with real-time search filtering.
 */

import { showSheet } from './full-screen-sheet.js';
import { t } from '../../shared/i18n.js';

// Built fresh each time the modal opens so labels reflect the active locale
// (the locale is fixed for a page load; changing it reloads — see i18n.js).
function getShortcuts() {
  return [
    {
      category: t('shortcuts.catGeneral'),
      items: [
        { desc: t('shortcuts.searchSessions'), keys: ['⌘', 'K'], keysWin: ['Ctrl', 'K'] },
        { desc: t('shortcuts.toggleSidebar'), keys: ['⌘', 'B'], keysWin: ['Ctrl', 'B'] },
        { desc: t('shortcuts.newSession'), keys: ['⌘', 'T'], keysWin: ['Ctrl', 'T'] },
        { desc: t('shortcuts.toggleTheme'), keys: ['⌘', '⇧', 'L'], keysWin: ['Ctrl', 'Shift', 'L'] },
        { desc: t('shortcuts.toggleHelp'), keys: ['⌘', '/'], keysWin: ['Ctrl', '/'] },
      ]
    },
    {
      category: t('shortcuts.catComposer'),
      items: [
        { desc: t('shortcuts.focusInput'), keys: ['⇧', 'I'], keysWin: ['Shift', 'I'], note: t('shortcuts.noteOutsideInput') },
        { desc: t('shortcuts.cycleThinking'), keys: ['⇧', '⇥'], keysWin: ['Shift', 'Tab'], note: t('shortcuts.noteInsideInput') },
        { desc: t('shortcuts.switchModel'), keys: ['⌃', 'I'], keysWin: ['Ctrl', 'I'], note: t('shortcuts.noteInsideInput') },
        { desc: t('shortcuts.submit'), keys: ['↩'], keysWin: ['Enter'], note: t('shortcuts.noteInsideInput') },
      ]
    },
    {
      category: t('shortcuts.catVim'),
      note: t('shortcuts.vimNote'),
      items: [
        { desc: t('shortcuts.scrollDown'), keys: ['J'], keysWin: ['J'] },
        { desc: t('shortcuts.scrollUp'), keys: ['K'], keysWin: ['K'] },
        { desc: t('shortcuts.scrollTop'), keys: ['G', 'G'], keysWin: ['G', 'G'] },
        { desc: t('shortcuts.scrollBottom'), keys: ['⇧', 'G'], keysWin: ['Shift', 'G'] },
      ]
    }
  ];
}

export function showShortcutsModal({
  documentImpl = document,
  windowImpl = window,
} = {}) {
  const isMac = windowImpl.navigator?.platform?.toUpperCase().indexOf('MAC') >= 0;

  const SHORTCUTS = getShortcuts();

  const sheet = showSheet({
    title: t('shortcuts.title'),
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
      search.placeholder = t('shortcuts.searchPlaceholder');
      search.autocomplete = 'off';
      search.spellcheck = false;
      search.setAttribute('aria-label', t('shortcuts.searchAria'));
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
          content.innerHTML = `<div class="shortcuts-empty-state">${t('shortcuts.empty')}</div>`;
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
