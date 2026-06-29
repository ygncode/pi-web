<script>
  // Keyboard Shortcuts modal — Svelte port of live/shortcuts-modal.js. Renders
  // inside <FullScreenSheet> with reactive search filtering. Display-only
  // (no callbacks); opened via the bindable `open` prop.
  import { t } from '../../shared/i18n.js';
  import FullScreenSheet from './FullScreenSheet.svelte';

  let { open = $bindable(false) } = $props();

  const isMac =
    typeof navigator !== 'undefined' &&
    (navigator.platform || '').toUpperCase().indexOf('MAC') >= 0;

  // Built once at init so labels reflect the active locale (fixed per page load).
  const groups = [
    {
      category: t('shortcuts.catGeneral'),
      items: [
        { desc: t('shortcuts.searchSessions'), keys: ['⌘', 'K'], keysWin: ['Ctrl', 'K'] },
        { desc: t('shortcuts.toggleSidebar'), keys: ['⌘', 'B'], keysWin: ['Ctrl', 'B'] },
        { desc: t('shortcuts.newSession'), keys: ['⌘', 'T'], keysWin: ['Ctrl', 'T'] },
        {
          desc: t('shortcuts.toggleTheme'),
          keys: ['⌘', '⇧', 'L'],
          keysWin: ['Ctrl', 'Shift', 'L'],
        },
        { desc: t('shortcuts.toggleHelp'), keys: ['⌘', '/'], keysWin: ['Ctrl', '/'] },
      ],
    },
    {
      category: t('shortcuts.catComposer'),
      items: [
        {
          desc: t('shortcuts.focusInput'),
          keys: ['⇧', 'I'],
          keysWin: ['Shift', 'I'],
          note: t('shortcuts.noteOutsideInput'),
        },
        {
          desc: t('shortcuts.cycleThinking'),
          keys: ['⇧', '⇥'],
          keysWin: ['Shift', 'Tab'],
          note: t('shortcuts.noteInsideInput'),
        },
        {
          desc: t('shortcuts.switchModel'),
          keys: ['⌃', 'I'],
          keysWin: ['Ctrl', 'I'],
          note: t('shortcuts.noteInsideInput'),
        },
        {
          desc: t('shortcuts.compact'),
          keys: ['⌘', 'L'],
          keysWin: ['Ctrl', 'L'],
          note: t('shortcuts.noteInsideInput'),
        },
        {
          desc: t('shortcuts.submit'),
          keys: ['↩'],
          keysWin: ['Enter'],
          note: t('shortcuts.noteInsideInput'),
        },
      ],
    },
    {
      category: t('shortcuts.catVim'),
      note: t('shortcuts.vimNote'),
      items: [
        { desc: t('shortcuts.scrollDown'), keys: ['J'], keysWin: ['J'] },
        { desc: t('shortcuts.scrollUp'), keys: ['K'], keysWin: ['K'] },
        { desc: t('shortcuts.scrollTop'), keys: ['G', 'G'], keysWin: ['G', 'G'] },
        { desc: t('shortcuts.scrollBottom'), keys: ['⇧', 'G'], keysWin: ['Shift', 'G'] },
      ],
    },
  ];

  let query = $state('');

  const filtered = $derived.by(() => {
    const q = query.toLowerCase().trim();
    return groups
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) => item.desc.toLowerCase().includes(q) || cat.category.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  });

  const keysFor = (item) => (isMac ? item.keys : item.keysWin || item.keys);

  // Focus the search box shortly after open (parity with the old 50ms focus).
  let searchEl = $state(null);
  $effect(() => {
    if (open && searchEl) {
      const id = setTimeout(() => searchEl?.focus(), 50);
      return () => clearTimeout(id);
    }
  });
</script>

<FullScreenSheet
  bind:open
  title={t('shortcuts.title')}
  showClose={false}
  backdropClass="shortcuts-sheet-backdrop"
  panelClass="shortcuts-sheet-panel"
  bodyClass="shortcuts-sheet-body"
>
  <div class="shortcuts-palette">
    <div class="shortcuts-search-wrap">
      <input
        class="shortcuts-search-input"
        type="search"
        bind:value={query}
        bind:this={searchEl}
        placeholder={t('shortcuts.searchPlaceholder')}
        autocomplete="off"
        spellcheck="false"
        aria-label={t('shortcuts.searchAria')}
      />
    </div>
    <div class="shortcuts-palette-content">
      {#if filtered.length === 0}
        <div class="shortcuts-empty-state">{t('shortcuts.empty')}</div>
      {:else}
        {#each filtered as cat (cat.category)}
          <div class="shortcuts-group">
            <div class="shortcuts-group-title">
              {cat.category}{#if cat.note}<span class="shortcuts-group-note">{cat.note}</span>{/if}
            </div>
            <div class="shortcuts-list">
              {#each cat.items as item (item.desc)}
                <div class="shortcuts-item">
                  <div class="shortcuts-item-desc">
                    {item.desc}{#if item.note}<span class="shortcuts-item-note">{item.note}</span
                      >{/if}
                  </div>
                  <div class="shortcuts-item-keys">
                    {#each keysFor(item) as k, keyIndex (keyIndex)}<kbd class="shortcuts-kbd"
                        >{k}</kbd
                      >
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</FullScreenSheet>
