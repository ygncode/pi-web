<script>
  // The message pane: renders the active root→leaf path from the reactive model
  // as <SessionEntry> components, replacing the navigator's imperative #messages
  // build. Keyed by entry id so navigation and live reload add/update/remove
  // entries reactively. `afterRender(container)` runs after each (re)render to
  // re-apply toggle state, lazy-highlight pending code, and scroll — concerns the
  // imperative layer still owns. Shared by the live app + the static export.
  import { getSessionModel } from '../../session/session-context.js';
  import SessionEntry from './SessionEntry.svelte';

  let { model = getSessionModel(), afterRender = null, live = false } = $props();

  let containerEl = $state(null);

  // Re-run post-render side effects whenever the rendered path changes.
  $effect(() => {
    // eslint-disable-next-line no-unused-expressions
    model.activePath;
    if (containerEl && typeof afterRender === 'function') {
      afterRender(containerEl);
    }
  });
</script>

<div id="messages-list" class="messages-list" bind:this={containerEl}>
  {#each model.activePath as entry (entry.id)}
    <SessionEntry {entry} {model} {live} />
  {/each}
</div>
