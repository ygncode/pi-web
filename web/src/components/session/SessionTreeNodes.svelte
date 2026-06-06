<script>
  // Renders the session tree node list + status line from the reactive
  // SessionDataModel. Live-safe (no SSE/fetch) → usable by live and export.
  // Replaces the imperative render/diff loop in tree-renderer.js: the
  // {#each model.filteredNodes} block recomputes automatically whenever the
  // model's entries / filter / active path change — no manual DOM patching.
  //
  // Not yet wired into SessionTree.svelte (the live shell) — that cut-over
  // happens with full e2e verification. See docs/dev/svelte-migration-plan.md.
  import { getSessionModel } from '../../session/session-context.js';
  import { buildTreePrefix } from '../../session/tree/session-tree.js';
  import { getTreeNodeDisplayHtml, escapeHtml } from '../../session/render/session-format.js';
  import { extractContent } from '../../session/tree/session-filter.js';
  import TreeNode from './TreeNode.svelte';

  // Falls back to context; tests may inject the model directly.
  let { model = getSessionModel() } = $props();

  const displayHtml = (flatNode) =>
    getTreeNodeDisplayHtml(flatNode.node.entry, flatNode.node.label, {
      extractContent,
      toolCallMap: model.toolCallMap,
      escapeHtmlImpl: (text) => escapeHtml(text, { documentImpl: document }),
    });

  // Parity with tree-renderer.js: clicking a node navigates to the NEWEST leaf
  // under it, while the clicked node becomes the scroll target.
  function navigate(id) {
    model.navigateTo(model.newestLeaf(id) || id, id);
  }
</script>

<div class="tree-container" id="tree-container">
  {#each model.filteredNodes as flatNode (flatNode.node.entry.id)}
    <TreeNode
      id={flatNode.node.entry.id}
      prefix={buildTreePrefix(flatNode)}
      displayHtml={displayHtml(flatNode)}
      onPath={model.activePathIds.has(flatNode.node.entry.id)}
      active={flatNode.node.entry.id === model.currentTargetId}
      onnavigate={navigate}
    />
  {/each}
</div>
<div class="tree-status" id="tree-status">{model.filteredNodes.length} / {model.flatNodes.length} entries</div>
