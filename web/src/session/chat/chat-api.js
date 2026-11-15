export function chatUrl(path, sessionId) {
  return `${path}?id=${encodeURIComponent(sessionId)}`;
}

export function cancelChat(sessionId, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/chat/cancel', sessionId), { method: 'POST' });
}

export function sendChat(sessionId, body, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/chat', sessionId), { method: 'POST', body });
}

export function getWorkerStatus(sessionId, { fetchImpl = fetch } = {}) {
  return fetchImpl(chatUrl('/api/worker-status', sessionId));
}

// The model list is server-static for the lifetime of the page: cache the
// first response so every session navigation (and the toolbar) reuses it
// instead of paying another round trip on slow links.
let modelsCache = null;

export function listModels({ fetchImpl = fetch } = {}) {
  if (modelsCache) return modelsCache;
  modelsCache = fetchImpl('/api/models').then(
    (r) => {
      if (!r.ok) {
        modelsCache = null;
        return r;
      }
      return r;
    },
    (err) => {
      modelsCache = null;
      throw err;
    },
  );
  return modelsCache;
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
