// ============================================================
// TREE RENDERING (DOM manipulation)
// ============================================================

let currentLeafId = leafId;
let currentTargetId = urlTargetId || leafId;
let treeRendered = false;

function renderTree() {
  const tree = buildTree();
  const activePathIds = buildActivePathIds(currentLeafId);
  const flatNodes = flattenTree(tree, activePathIds);
  const filtered = filterNodes(flatNodes, currentLeafId);
  const container = document.getElementById('tree-container');

  // Full render only on first call or when filter/search changes
  if (!treeRendered) {
    container.innerHTML = '';

    for (const flatNode of filtered) {
      const entry = flatNode.node.entry;
      const isOnPath = activePathIds.has(entry.id);
      const isTarget = entry.id === currentTargetId;

      const div = document.createElement('div');
      div.className = 'tree-node';
      if (isOnPath) div.classList.add('in-path');
      if (isTarget) div.classList.add('active');
      div.dataset.id = entry.id;

      const prefix = buildTreePrefix(flatNode);
      const prefixSpan = document.createElement('span');
      prefixSpan.className = 'tree-prefix';
      prefixSpan.textContent = prefix;

      const marker = document.createElement('span');
      marker.className = 'tree-marker';
      marker.textContent = isOnPath ? '•' : ' ';

      const content = document.createElement('span');
      content.className = 'tree-content';
      content.innerHTML = getTreeNodeDisplayHtml(entry, flatNode.node.label);

      div.appendChild(prefixSpan);
      div.appendChild(marker);
      div.appendChild(content);
      // Navigate to the newest leaf through this node, but scroll to the clicked node
      div.addEventListener('click', () => {
        if (window.getSelection().toString()) return;
        const leafId = findNewestLeaf(entry.id);
        navigateTo(leafId, 'target', entry.id);
        if (isMobileLayout()) closeSidebar();
      });

      container.appendChild(div);
    }

    treeRendered = true;
  } else {
    // Just update markers and classes
    const nodes = container.querySelectorAll('.tree-node');
    for (const node of nodes) {
      const id = node.dataset.id;
      const isOnPath = activePathIds.has(id);
      const isTarget = id === currentTargetId;

      node.classList.toggle('in-path', isOnPath);
      node.classList.toggle('active', isTarget);

      const marker = node.querySelector('.tree-marker');
      if (marker) {
        marker.textContent = isOnPath ? '•' : ' ';
      }
    }
  }

  document.getElementById('tree-status').textContent = `${filtered.length} / ${flatNodes.length} entries`;

  // Scroll active node into view after layout
  setTimeout(() => {
    const activeNode = container.querySelector('.tree-node.active');
    if (activeNode) {
      activeNode.scrollIntoView({ block: 'nearest' });
    }
  }, 0);
}

function forceTreeRerender() {
  treeRendered = false;
  renderTree();
}
