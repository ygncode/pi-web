// ============================================================
// FILTERING (pure data)
// ============================================================

let filterMode = 'default';
let searchQuery = '';

function hasTextContent(content) {
  if (typeof content === 'string') return content.trim().length > 0;
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === 'text' && c.text && c.text.trim().length > 0) return true;
    }
  }
  return false;
}

function extractContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text)
      .join('');
  }
  return '';
}

function getSearchableText(entry, label) {
  const parts = [];
  if (label) parts.push(label);

  switch (entry.type) {
    case 'message': {
      const msg = entry.message;
      parts.push(msg.role);
      if (msg.content) parts.push(extractContent(msg.content));
      if (msg.role === 'bashExecution' && msg.command) parts.push(msg.command);
      break;
    }
    case 'custom_message':
      parts.push(entry.customType);
      parts.push(typeof entry.content === 'string' ? entry.content : extractContent(entry.content));
      break;
    case 'compaction':
      parts.push('compaction');
      break;
    case 'branch_summary':
      parts.push('branch summary', entry.summary);
      break;
    case 'model_change':
      parts.push('model', entry.modelId);
      break;
    case 'thinking_level_change':
      parts.push('thinking', entry.thinkingLevel);
      break;
  }

  return parts.join(' ').toLowerCase();
}

/**
 * Filter flat nodes based on current filterMode and searchQuery.
 */
function filterNodes(flatNodes, currentLeafId) {
  const searchTokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

  const filtered = flatNodes.filter(flatNode => {
    const entry = flatNode.node.entry;
    const label = flatNode.node.label;
    const isCurrentLeaf = entry.id === currentLeafId;

    // Always show current leaf
    if (isCurrentLeaf) return true;

    // Hide assistant messages with only tool calls (no text) unless error/aborted
    if (entry.type === 'message' && entry.message.role === 'assistant') {
      const msg = entry.message;
      const hasText = hasTextContent(msg.content);
      const isErrorOrAborted = msg.stopReason && msg.stopReason !== 'stop' && msg.stopReason !== 'toolUse';
      if (!hasText && !isErrorOrAborted) return false;
    }

    // Apply filter mode
    const isSettingsEntry = ['label', 'custom', 'model_change', 'thinking_level_change'].includes(entry.type);
    let passesFilter = true;

    switch (filterMode) {
      case 'user-only':
        passesFilter = entry.type === 'message' && entry.message.role === 'user';
        break;
      case 'no-tools':
        passesFilter = !isSettingsEntry && !(entry.type === 'message' && entry.message.role === 'toolResult');
        break;
      case 'labeled-only':
        passesFilter = label !== undefined;
        break;
      case 'all':
        passesFilter = true;
        break;
      default: // 'default'
        passesFilter = !isSettingsEntry;
        break;
    }

    if (!passesFilter) return false;

    // Apply search filter
    if (searchTokens.length > 0) {
      const nodeText = getSearchableText(entry, label);
      if (!searchTokens.every(t => nodeText.includes(t))) return false;
    }

    return true;
  });

  // Recalculate visual structure based on visible tree
  recalculateVisualStructure(filtered, flatNodes);

  return filtered;
}

/**
 * Recompute indentation/connectors for the filtered view
 *
 * Filtering can hide intermediate entries; descendants attach to the nearest visible ancestor.
 * Keep indentation semantics aligned with flattenTree() so single-child chains don't drift right.
 */
function recalculateVisualStructure(filteredNodes, allFlatNodes) {
  if (filteredNodes.length === 0) return;

  const visibleIds = new Set(filteredNodes.map(n => n.node.entry.id));

  // Build entry map for parent lookup (using full tree)
  const entryMap = new Map();
  for (const flatNode of allFlatNodes) {
    entryMap.set(flatNode.node.entry.id, flatNode);
  }

  // Find nearest visible ancestor for a node
  function findVisibleAncestor(nodeId) {
    let currentId = entryMap.get(nodeId)?.node.entry.parentId;
    while (currentId != null) {
      if (visibleIds.has(currentId)) {
        return currentId;
      }
      currentId = entryMap.get(currentId)?.node.entry.parentId;
    }
    return null;
  }

  // Build visible tree structure
  const visibleParent = new Map();
  const visibleChildren = new Map();
  visibleChildren.set(null, []); // root-level nodes

  for (const flatNode of filteredNodes) {
    const nodeId = flatNode.node.entry.id;
    const ancestorId = findVisibleAncestor(nodeId);
    visibleParent.set(nodeId, ancestorId);

    if (!visibleChildren.has(ancestorId)) {
      visibleChildren.set(ancestorId, []);
    }
    visibleChildren.get(ancestorId).push(nodeId);
  }

  // Update multipleRoots based on visible roots
  const visibleRootIds = visibleChildren.get(null);
  const multipleRoots = visibleRootIds.length > 1;

  // Build a map for quick lookup: nodeId → FlatNode
  const filteredNodeMap = new Map();
  for (const flatNode of filteredNodes) {
    filteredNodeMap.set(flatNode.node.entry.id, flatNode);
  }

  // DFS traversal of visible tree, applying same indentation rules as flattenTree()
  // Stack items: [nodeId, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild]
  const stack = [];

  // Add visible roots in reverse order (to process in forward order via stack)
  for (let i = visibleRootIds.length - 1; i >= 0; i--) {
    const isLast = i === visibleRootIds.length - 1;
    stack.push([
      visibleRootIds[i],
      multipleRoots ? 1 : 0,
      multipleRoots,
      multipleRoots,
      isLast,
      [],
      multipleRoots
    ]);
  }

  while (stack.length > 0) {
    const [nodeId, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild] = stack.pop();

    const flatNode = filteredNodeMap.get(nodeId);
    if (!flatNode) continue;

    // Update this node's visual properties
    flatNode.indent = indent;
    flatNode.showConnector = showConnector;
    flatNode.isLast = isLast;
    flatNode.gutters = gutters;
    flatNode.isVirtualRootChild = isVirtualRootChild;
    flatNode.multipleRoots = multipleRoots;

    // Get visible children of this node
    const children = visibleChildren.get(nodeId) || [];
    const multipleChildren = children.length > 1;

    // Calculate child indent using same rules as flattenTree():
    // - Parent branches (multiple children): children get +1
    // - Just branched and indent > 0: children get +1 for visual grouping
    // - Single-child chain: stay flat
    let childIndent;
    if (multipleChildren) {
      childIndent = indent + 1;
    } else if (justBranched && indent > 0) {
      childIndent = indent + 1;
    } else {
      childIndent = indent;
    }

    // Build gutters for children (same logic as flattenTree)
    const connectorDisplayed = showConnector && !isVirtualRootChild;
    const currentDisplayIndent = multipleRoots ? Math.max(0, indent - 1) : indent;
    const connectorPosition = Math.max(0, currentDisplayIndent - 1);
    const childGutters = connectorDisplayed
      ? [...gutters, { position: connectorPosition, show: !isLast }]
      : gutters;

    // Add children in reverse order (to process in forward order via stack)
    for (let i = children.length - 1; i >= 0; i--) {
      const childIsLast = i === children.length - 1;
      stack.push([
        children[i],
        childIndent,
        multipleChildren,
        multipleChildren,
        childIsLast,
        childGutters,
        false
      ]);
    }
  }
}
