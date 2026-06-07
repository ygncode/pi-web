<script>
  // One conversation entry in the message pane. First migration pass: wrap the
  // existing battle-tested renderEntry() HTML via {@html} so we get reactive
  // orchestration (the {#each} owns add/update/remove) without rewriting the
  // 638-LOC renderer at once. Decompose into real sub-components later.
  // Live-safe (renderEntry is injected) → usable by live + export.
  // See docs/dev/svelte-migration-plan.md (combined Phase 2/3 step).
  let { entry, renderEntry } = $props();

  const html = $derived(typeof renderEntry === 'function' ? (renderEntry(entry) || '') : '');
</script>

{@html html}
