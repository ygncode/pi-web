export function createSeenEntrySet({ documentImpl = document } = {}) {
  const seen = new Set();
  documentImpl.querySelectorAll('[id^="entry-"]').forEach((el) => {
    seen.add(el.id.replace('entry-', ''));
  });
  return seen;
}

export function buildEntryNode(entry, allEntries, { documentImpl = document, renderEntry, applyToggleStateToNode } = {}) {
  const html = renderEntry(entry, allEntries);
  if (!html) return null;
  const wrap = documentImpl.createElement('div');
  wrap.innerHTML = html;
  const node = wrap.firstElementChild;
  if (!node) return null;
  applyToggleStateToNode?.(node);
  return node;
}

export function highlightNewEntry(node, { windowImpl = window } = {}) {
  node.style.transition = 'box-shadow 0.8s ease-out';
  node.style.boxShadow = '0 0 0 2px var(--accent)';
  windowImpl.setTimeout(() => { node.style.boxShadow = ''; }, 1500);
}

export function appendEntry(entry, allEntries, state, env = {}) {
  const { documentImpl = document } = env;
  if (state.seen.has(entry.id)) return false;
  const container = documentImpl.getElementById('messages');
  if (!container) return false;
  const node = buildEntryNode(entry, allEntries, env);
  state.seen.add(entry.id);
  if (!node) return false;
  container.appendChild(node);
  state.liveRendered.add(entry.id);
  highlightNewEntry(node, env);
  return true;
}

export function upsertEntry(entry, allEntries, state, env = {}) {
  const { documentImpl = document } = env;
  if (!entry.id) return false;
  const existing = documentImpl.getElementById('entry-' + entry.id);
  if (!existing) return appendEntry(entry, allEntries, state, env);
  const node = buildEntryNode(entry, allEntries, env);
  if (!node) return false;
  existing.replaceWith(node);
  state.liveRendered.add(entry.id);
  return false;
}

export function refreshEntriesAffectedByToolResult(toolResultEntry, allEntries, state, env = {}) {
  if (!toolResultEntry.message || !toolResultEntry.message.toolCallId) return;
  allEntries.forEach((candidate) => {
    if (!candidate.id || !candidate.message || candidate.message.role !== 'assistant') return;
    const content = candidate.message.content || [];
    const usesToolResult = content.some((block) => block.type === 'toolCall' && block.id === toolResultEntry.message.toolCallId);
    if (usesToolResult) upsertEntry(candidate, allEntries, state, env);
  });
}
