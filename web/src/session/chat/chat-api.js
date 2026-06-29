export function chatUrl(path, sessionId) {
  return `${path}?id=${encodeURIComponent(sessionId)}`;
}

export function cancelChat(sessionId, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/chat/cancel', sessionId), { method: 'POST' });
}

export function sendChat(sessionId, body, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/chat', sessionId), { method: 'POST', body });
}

// Compact is its own endpoint, not a chat message: pi's rpc prompt path treats
// "/compact" as literal text, so real compaction requires POST /api/compact
// (which runs pi's dedicated `compact` rpc command).
export function compact(sessionId, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/compact', sessionId), { method: 'POST' });
}

export function getWorkerStatus(sessionId, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/worker-status', sessionId));
}

export function listModels({ fetchImpl = fetch } = {}) {
  return fetchImpl('/api/models');
}

export function getCommands(sessionId, { load = false } = {}, { fetchImpl = fetch } = {}) {
  const url = chatUrl('/api/commands', sessionId) + (load ? '&load=1' : '');
  return fetchImpl(url);
}

export function getFiles(sessionId, query, { signal, fetchImpl = fetch } = {}) {
  const url = chatUrl('/api/files', sessionId) + '&q=' + encodeURIComponent(query || '');
  return fetchImpl(url, { signal });
}

export function setModel(sessionId, { provider, modelId }, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/set-model', sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, modelId }),
  });
}

export function setThinkingLevel(sessionId, level, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/set-thinking-level', sessionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });
}
