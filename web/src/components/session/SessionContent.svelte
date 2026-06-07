<script>
  // The message pane: renders the active root→leaf path from the reactive model,
  // replacing the navigator's imperative #messages build. Keyed by entry id so
  // navigation and live reload add/update/remove entries reactively.
  //
  // `renderEntry` is injected (created later by the imperative runtime with its
  // marked/hljs/etc. deps); passing it reactively means entries paint as soon as
  // it is available. `afterRender(container)` runs after each (re)render to apply
  // toggle state, wire delegated buttons, lazy-highlight code, and scroll —
  // concerns that still live in the imperative layer for now.
  import { getSessionModel } from '../../session/session-context.js';
  import SessionEntry from './SessionEntry.svelte';

  let { model = getSessionModel(), renderEntry = null, afterRender = null } = $props();

  let containerEl = $state(null);

  // Re-run post-render side effects whenever the rendered path or renderer
  // changes. Reading activePath + renderEntry registers the dependencies.
  $effect(() => {
    // eslint-disable-next-line no-unused-expressions
    model.activePath;
    // eslint-disable-next-line no-unused-expressions
    renderEntry;
    if (containerEl && typeof afterRender === 'function') {
      afterRender(containerEl);
    }
  });
</script>

<div id="messages-list" class="messages-list" bind:this={containerEl}>
  {#each model.activePath as entry (entry.id)}
    <SessionEntry {entry} {renderEntry} />
  {/each}
</div>
