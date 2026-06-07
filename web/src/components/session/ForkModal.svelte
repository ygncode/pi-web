<script module>
  // Pure helpers shared with SessionPage's open-bridge (for the empty check).
  export function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function truncateText(text, maxLength = 96) {
    const n = normalizeText(text);
    if (!n) return '(empty)';
    return n.length <= maxLength ? n : n.slice(0, maxLength).trimEnd() + '…';
  }

  function extractUserMessageText(entry) {
    if (entry?.type !== 'message') return '';
    const msg = entry.message;
    if (!msg || msg.role !== 'user') return '';
    const content = msg.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.filter((b) => b?.type === 'text').map((b) => b.text).join(' ');
    }
    return '';
  }

  // Latest user messages first; `number` is the 1-based position in send order.
  export function buildUserMessageList(entries = []) {
    const messages = [];
    for (const entry of entries) {
      const text = normalizeText(extractUserMessageText(entry));
      if (text) messages.push({ entryId: entry.id, text, number: messages.length + 1 });
    }
    return messages.reverse();
  }
</script>

<script>
  // Fork palette — Svelte port of live/fork-modal.js. Lists the session's user
  // messages so one can be picked to fork from; search + keyboard nav + preview.
  // Opened via the bindable `open` prop; `entries` are passed fresh (the caller
  // fetches them) and `onSelect(entryId)` performs the fork.
  import FullScreenSheet from './FullScreenSheet.svelte';

  let { open = $bindable(false), entries = [], onSelect = null } = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let listEl = $state(null);
  let searchEl = $state(null);

  const userMessages = $derived(buildUserMessageList(entries));
  const filtered = $derived.by(() => {
    const q = normalizeText(query).toLowerCase();
    if (!q) return userMessages;
    return userMessages.filter((m) =>
      m.text.toLowerCase().includes(q) || String(m.number).includes(q.replace(/^#/, '')));
  });
  const selected = $derived(filtered.length ? filtered[Math.min(selectedIndex, filtered.length - 1)] : null);

  function move(delta, focus) {
    if (filtered.length === 0) return;
    selectedIndex = Math.max(0, Math.min(selectedIndex + delta, filtered.length - 1));
    const el = listEl?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
    if (focus) el?.focus?.();
  }

  function choose(msg) {
    if (!msg) return;
    open = false;
    onSelect?.(msg.entryId);
  }

  function navKey(e, focus) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1, focus); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, focus); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(filtered[selectedIndex]); }
  }

  // Reset the highlight whenever the query changes.
  $effect(() => { void query; selectedIndex = 0; });

  // Focus the search box shortly after open (parity with the old rAF focus).
  $effect(() => {
    if (open && searchEl) {
      const id = setTimeout(() => searchEl?.focus(), 50);
      return () => clearTimeout(id);
    }
  });
</script>

<FullScreenSheet
  bind:open
  title="Fork from message"
  showClose={false}
  backdropClass="fork-sheet-backdrop"
  panelClass="fork-sheet-panel"
  bodyClass="fork-sheet-body"
>
  <div class="fork-palette">
    <div class="fork-search-wrap">
      <input
        class="fork-search-input"
        type="search"
        bind:value={query}
        bind:this={searchEl}
        onkeydown={(e) => navKey(e, false)}
        placeholder="Search messages..."
        autocomplete="off"
        spellcheck="false"
        aria-label="Search messages to fork from"
      >
    </div>
    <div class="fork-palette-content">
      <div class="fork-message-list" role="listbox" aria-label="Messages" tabindex="-1" bind:this={listEl} onkeydown={(e) => navKey(e, true)}>
        {#if filtered.length === 0}
          <div class="fork-empty-state">No matching messages</div>
        {:else}
          {#each filtered as msg, i (msg.entryId)}
            <button
              class="fork-message-item"
              class:is-selected={i === selectedIndex}
              type="button"
              role="option"
              data-idx={i}
              aria-selected={i === selectedIndex}
              onmouseenter={() => (selectedIndex = i)}
              onfocus={() => (selectedIndex = i)}
              onclick={() => choose(msg)}
            >
              <span class="fork-message-text">{truncateText(msg.text)}</span>
              <span class="fork-message-number">#{msg.number}</span>
            </button>
          {/each}
        {/if}
      </div>
      <aside class="fork-message-preview" aria-live="polite">
        {#if selected}
          <div class="fork-preview-meta">#{selected.number}</div>
          <div class="fork-preview-title">{truncateText(selected.text, 80)}</div>
          <div class="fork-preview-body">{selected.text}</div>
        {:else}
          <div class="fork-empty-state">No matching messages</div>
        {/if}
      </aside>
    </div>
    <div class="fork-palette-footer">↑↓ navigate • enter select • esc close</div>
  </div>
</FullScreenSheet>
