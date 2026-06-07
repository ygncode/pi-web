<script>
  // Reusable full-screen sheet: a centered dialog on desktop, a fullscreen
  // bottom-sheet on mobile (≤ 900px). Svelte port of the former
  // live/full-screen-sheet.js (showSheet) — same markup/classes/behavior:
  // scroll-lock (ref-counted), focus trap, Escape/backdrop close, and a
  // synthetic history entry on mobile so the back gesture closes the sheet.
  //
  // Driven by a single bindable `open`; internal triggers (Escape, backdrop,
  // back/close buttons, mobile popstate) set `open = false` and an $effect runs
  // the open/close side effects. Body content is provided as the default snippet.
  import { onMount, tick } from 'svelte';
  import { icon, X } from '../../shared/icons.js';

  let {
    open = $bindable(false),
    title = '',
    showBack = true,
    showClose = true,
    closeOnEscape = true,
    closeOnBackdrop = true,
    onClose = null,
    // Per-modal styling hooks (the former showSheet consumers tagged the
    // backdrop/panel/body with their own classes for CSS).
    backdropClass = '',
    panelClass = '',
    bodyClass = '',
    children,
  } = $props();

  const SHEET_BREAKPOINT = 900;
  const REMOVE_DELAY = 300; // must match the CSS transition duration

  let mounted = $state(false); // DOM presence (stays true through the close anim)
  let shown = $state(false); // toggles the `.open` class for the CSS transition
  let mobile = $state(false);
  let backdropEl = $state(null);
  let panelEl = $state(null);

  let previousActive = null;
  let removeTimer = null;
  let popHandler = null;
  let historyMarker = '';
  let skipHistoryOnce = false;

  // Backdrop click-to-close, attached imperatively (not inline onclick) to match
  // the codebase's delegated-listener convention and avoid an a11y lint on a
  // non-interactive element — Escape (onKey) is the keyboard equivalent.
  function onBackdrop(e) {
    if (closeOnBackdrop && e.target === backdropEl) open = false;
  }

  function isMobile() {
    return typeof window.matchMedia === 'function'
      && window.matchMedia(`(max-width: ${SHEET_BREAKPOINT}px)`).matches;
  }

  let scrollLocked = false;

  // Ref-counted page-scroll lock so nested/stacked sheets don't unlock early.
  function lockScroll() {
    if (scrollLocked) return;
    scrollLocked = true;
    const body = document.body;
    const count = Number(body.dataset.piSheetCount || '0') + 1;
    body.dataset.piSheetCount = String(count);
    body.classList.add('pi-sheet-open');
  }
  function unlockScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    const body = document.body;
    const count = Math.max(0, Number(body.dataset.piSheetCount || '0') - 1);
    if (count === 0) {
      delete body.dataset.piSheetCount;
      body.classList.remove('pi-sheet-open');
    } else {
      body.dataset.piSheetCount = String(count);
    }
  }

  function getFocusable() {
    if (!panelEl) return [];
    return Array.from(panelEl.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
  }

  function onKey(e) {
    if (closeOnEscape && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      open = false;
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = getFocusable();
    if (focusables.length === 0) { e.preventDefault(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !panelEl.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last || !panelEl.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  async function doOpen() {
    mounted = true;
    shown = false;
    mobile = isMobile();
    previousActive = document.activeElement;
    lockScroll();
    document.addEventListener('keydown', onKey);

    if (mobile && window.history && typeof window.history.pushState === 'function') {
      historyMarker = `pi-sheet:${Math.random().toString(36).slice(2, 8)}`;
      const cur = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
      try { window.history.pushState({ ...cur, __piSheet: historyMarker }, '', window.location?.href); } catch { /* ignore */ }
      popHandler = () => { skipHistoryOnce = true; open = false; };
      window.addEventListener('popstate', popHandler);
    }

    await tick();
    backdropEl?.addEventListener('click', onBackdrop);
    requestAnimationFrame(() => {
      shown = true;
      const focusables = getFocusable();
      (focusables[0] || panelEl)?.focus();
    });
  }

  function doClose() {
    backdropEl?.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKey);
    if (popHandler) {
      window.removeEventListener('popstate', popHandler);
      if (!skipHistoryOnce && window.history?.state?.__piSheet === historyMarker) {
        try { window.history.back(); } catch { /* ignore */ }
      }
      popHandler = null;
    }
    skipHistoryOnce = false;
    unlockScroll();
    shown = false;
    clearTimeout(removeTimer);
    removeTimer = setTimeout(() => {
      mounted = false;
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
    }, REMOVE_DELAY);
    if (onClose) onClose();
  }

  // Single source of truth: the bindable `open` drives mount + teardown.
  $effect(() => {
    if (open && !mounted) doOpen();
    else if (!open && mounted) doClose();
  });

  // Release any global listeners / scroll-lock / pending timer if the component
  // is destroyed while still open (e.g. SPA route change).
  onMount(() => () => {
    document.removeEventListener('keydown', onKey);
    backdropEl?.removeEventListener('click', onBackdrop);
    if (popHandler) window.removeEventListener('popstate', popHandler);
    clearTimeout(removeTimer);
    unlockScroll();
  });
</script>

{#if mounted}
  <div
    class="pi-sheet-backdrop {backdropClass}"
    class:pi-sheet-mobile={mobile}
    class:open={shown}
    bind:this={backdropEl}
  >
    <div
      class="pi-sheet-panel {panelClass}"
      class:pi-sheet-mobile={mobile}
      class:open={shown}
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
    >
      <h2 class="sr-only">{title}</h2>
      <div class="pi-sheet-header">
        {#if showBack}
          <button class="pi-sheet-back" aria-label={`Close ${title}`} onclick={() => (open = false)}>
            <span aria-hidden="true">←</span><span>{title}</span>
          </button>
        {:else}
          <div></div>
        {/if}
        {#if showClose}
          <button class="pi-sheet-close-x" aria-label="Close" onclick={() => (open = false)}>{@html icon(X, { size: 16 })}</button>
        {/if}
      </div>
      <div class="pi-sheet-body {bodyClass}">{@render children?.()}</div>
    </div>
  </div>
{/if}
