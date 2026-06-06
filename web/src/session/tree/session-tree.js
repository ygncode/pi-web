export function buildTree(entries = [], labelMap = new Map()) {
  const nodeMap = new Map();
  const roots = [];

  // Deduplicate by ID keeping the last occurrence (consistent with byId Map)
  const seenIds = new Set();
  const treeEntries = [];
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!entry?.id) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    treeEntries.unshift(entry);
  }

  for (const entry of treeEntries) {
    nodeMap.set(entry.id, { entry, children: [], label: labelMap.get(entry.id) });
  }

  for (const entry of treeEntries) {
    const node = nodeMap.get(entry.id);
    if (entry.parentId === null || entry.parentId === undefined || entry.parentId === entry.id) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(entry.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  function sortChildren(node) {
    node.children.sort((a, b) => new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime());
    node.children.forEach(sortChildren);
  }
  roots.forEach(sortChildren);
  return roots;
}

export function buildActivePathIds(targetId, byId = new Map()) {
  const ids = new Set();
  let current = byId.get(targetId);
  while (current) {
    ids.add(current.id);
    if (!current.parentId || current.parentId === current.id) break;
    current = byId.get(current.parentId);
  }
  return ids;
}

export function getPath(targetId, byId = new Map()) {
  const path = [];
  let current = byId.get(targetId);
  while (current) {
    path.unshift(current);
    if (!current.parentId || current.parentId === current.id) break;
    current = byId.get(current.parentId);
  }
  return path;
}

export function buildTreeNodeMap(roots = []) {
  const treeNodeMap = new Map();
  function mapNodes(node) {
    treeNodeMap.set(node.entry.id, node);
    node.children.forEach(mapNodes);
  }
  roots.forEach(mapNodes);
  return treeNodeMap;
}

export function findNewestLeaf(nodeId, rootsOrNodeMap = []) {
  const treeNodeMap = rootsOrNodeMap instanceof Map ? rootsOrNodeMap : buildTreeNodeMap(rootsOrNodeMap);
  const node = treeNodeMap.get(nodeId);
  if (!node) return nodeId;

  function newestNavigable(current) {
    for (let i = current.children.length - 1; i >= 0; i -= 1) {
      const candidate = newestNavigable(current.children[i]);
      if (candidate) return candidate;
    }
    return current.entry.type === 'label' ? null : current.entry.id;
  }

  return newestNavigable(node) || nodeId;
}

export function flattenTree(roots, activePathIds) {
  const result = [];
  const multipleRoots = roots.length > 1;
  const containsActive = new Map();

  function markActive(node) {
    let has = activePathIds.has(node.entry.id);
    for (const child of node.children) {
      if (markActive(child)) has = true;
    }
    containsActive.set(node, has);
    return has;
  }
  roots.forEach(markActive);

  const stack = [];
  const orderedRoots = [...roots].sort((a, b) => Number(containsActive.get(b)) - Number(containsActive.get(a)));
  for (let i = orderedRoots.length - 1; i >= 0; i -= 1) {
    const isLast = i === orderedRoots.length - 1;
    stack.push([orderedRoots[i], multipleRoots ? 1 : 0, multipleRoots, multipleRoots, isLast, [], multipleRoots]);
  }

  while (stack.length > 0) {
    const [node, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild] = stack.pop();
    result.push({ node, indent, showConnector, isLast, gutters, isVirtualRootChild, multipleRoots });

    const children = node.children;
    const multipleChildren = children.length > 1;
    const orderedChildren = [...children].sort((a, b) => Number(containsActive.get(b)) - Number(containsActive.get(a)));
    let childIndent;
    if (multipleChildren) childIndent = indent + 1;
    else if (justBranched && indent > 0) childIndent = indent + 1;
    else childIndent = indent;

    const connectorDisplayed = showConnector && !isVirtualRootChild;
    const currentDisplayIndent = multipleRoots ? Math.max(0, indent - 1) : indent;
    const connectorPosition = Math.max(0, currentDisplayIndent - 1);
    const childGutters = connectorDisplayed ? [...gutters, { position: connectorPosition, show: !isLast }] : gutters;

    for (let i = orderedChildren.length - 1; i >= 0; i -= 1) {
      const childIsLast = i === orderedChildren.length - 1;
      stack.push([orderedChildren[i], childIndent, multipleChildren, multipleChildren, childIsLast, childGutters, false]);
    }
  }

  return result;
}

export function buildTreePrefix(flatNode) {
  const { indent, showConnector, isLast, gutters, isVirtualRootChild, multipleRoots } = flatNode;
  const displayIndent = multipleRoots ? Math.max(0, indent - 1) : indent;
  const connector = showConnector && !isVirtualRootChild ? (isLast ? '└─ ' : '├─ ') : '';
  const connectorPosition = connector ? displayIndent - 1 : -1;
  const totalChars = displayIndent * 3;
  const prefixChars = [];
  for (let i = 0; i < totalChars; i += 1) {
    const level = Math.floor(i / 3);
    const posInLevel = i % 3;
    const gutter = gutters.find((g) => g.position === level);
    if (gutter) prefixChars.push(posInLevel === 0 ? (gutter.show ? '│' : ' ') : ' ');
    else if (connector && level === connectorPosition) prefixChars.push(posInLevel === 0 ? (isLast ? '└' : '├') : (posInLevel === 1 ? '─' : ' '));
    else prefixChars.push(' ');
  }
  return prefixChars.join('');
}
