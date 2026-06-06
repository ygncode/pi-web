<script>
  // One row in the session tree sidebar. Pure presentational + live-safe (no
  // SSE/fetch/live-only imports) so it can be used by BOTH the live app and the
  // static export. Emits the SAME markup as the legacy tree-renderer.js so the
  // existing CSS and e2e selectors keep working:
  //
  //   <div class="tree-node [in-path] [active]" data-id=…>
  //     <span class="tree-prefix">…</span>
  //     <span class="tree-marker">• | ' '</span>
  //     <span class="tree-content">…html…</span>
  //   </div>
  //
  // See docs/dev/svelte-migration-plan.md (Phase 2).
  let { id, prefix = '', displayHtml = '', onPath = false, active = false, onnavigate } = $props();

  function activate() {
    // Ignore clicks that are really the end of a text selection (parity with
    // the legacy renderer, which checked window.getSelection()).
    if (typeof window !== 'undefined' && window.getSelection?.().toString()) return;
    onnavigate?.(id);
  }

  function onKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  }
</script>

<div
  class="tree-node"
  class:in-path={onPath}
  class:active
  data-id={id}
  role="treeitem"
  aria-selected={active}
  tabindex="-1"
  onclick={activate}
  onkeydown={onKeydown}
><span class="tree-prefix">{prefix}</span><span class="tree-marker">{onPath ? '•' : ' '}</span><span class="tree-content">{@html displayHtml}</span></div>
