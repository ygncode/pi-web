import { decodeBase64JSON } from '../session/data/session-data.js';
import { t } from '../shared/i18n.js';

// The session route's HTML shell embeds the session payload (and scratchpad) in
// a <script id="pi-session-bootstrap"> so the first paint needs no round-trip to
// /api/session or /api/scratchpad. Returns { id, data, scratchpad } or null.
export function readSessionBootstrap({ documentImpl, atobImpl, TextDecoderImpl } = {}) {
  const doc = documentImpl || (typeof document !== 'undefined' ? document : null);
  const el = doc?.getElementById?.('pi-session-bootstrap');
  const raw = el && el.textContent ? el.textContent.trim() : '';
  if (!raw) return null;
  try {
    return decodeBase64JSON(raw, { atobImpl, TextDecoderImpl });
  } catch {
    return null;
  }
}

export function encodePayload(payload, { btoaImpl = globalThis.btoa, TextEncoderImpl = globalThis.TextEncoder } = {}) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoderImpl().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoaImpl(binary);
}

export function newestLeaf(entries = []) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i]?.id) return entries[i].id;
  }
  return '';
}

export function firstMessageStub(entries = []) {
  const entry = entries.find((item) => item?.type === 'message' && item.message?.role === 'user');
  let content = entry?.message?.content;
  if (Array.isArray(content)) {
    content = content.map((part) => typeof part === 'string' ? part : (part?.text || '')).join('');
  }
  if (!content) return '';
  const text = String(content).slice(0, 500)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return `<div class="user-message" aria-hidden="true"><div class="markdown-content"><p>${text}</p></div></div>`;
}

export async function loadScratchpad(projectPath, { fetchImpl = fetch } = {}) {
  if (!projectPath) return '';
  try {
    const resp = await fetchImpl(`/api/scratchpad?project=${encodeURIComponent(projectPath)}`, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return '';
    const data = await resp.json();
    return data?.content || '';
  } catch {
    return '';
  }
}

export function buildSessionPageState({ sessionId, data, scratchpad = '', btoaImpl, TextEncoderImpl } = {}) {
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const header = data?.header || {};
  const cwd = header.cwd || '';
  const title = data?.name || sessionId;
  const leafId = newestLeaf(entries);
  const total = Number.isInteger(data?.total) ? data.total : entries.length;
  const from = Number.isInteger(data?.from) ? data.from : 0;
  const chatAvailable = data?.chatAvailable ?? data?.ChatAvailable ?? true;
  let chatDisabledReason = data?.chatDisabledReason || data?.ChatDisabledReason || '';
  if (!chatAvailable && !chatDisabledReason) {
    chatDisabledReason = 'This session can be viewed, but chat is disabled because its working directory no longer exists.';
  }
  const model = data?.model || data?.Model || '';
  const provider = data?.modelProvider || data?.ModelProvider || '';
  return {
    sessionId,
    title,
    entries,
    cwd,
    scratchpad,
    chatAvailable,
    chatDisabledReason,
    modelLabel: model && provider ? `${model} @ ${provider}` : model,
    payloadBase64: encodePayload({
      header,
      entries,
      name: title,
      leafId,
      systemPrompt: null,
      tools: null,
      renderedTools: null,
      total,
      from,
      truncated: entries.length < total,
    }, { btoaImpl, TextEncoderImpl }),
  };
}

export async function loadSessionPageState({ locationSearch = '', fetchImpl = fetch, btoaImpl, TextEncoderImpl, documentImpl, atobImpl, TextDecoderImpl } = {}) {
  const params = new URLSearchParams(locationSearch);
  const sessionId = params.get('id') || '';
  if (!sessionId) throw new Error(t('session.missingId'));

  // Prefer the payload embedded in the page shell — no fetch on first paint.
  const boot = readSessionBootstrap({ documentImpl, atobImpl, TextDecoderImpl });
  if (boot && boot.id === sessionId && boot.data) {
    return buildSessionPageState({ sessionId, data: boot.data, scratchpad: boot.scratchpad || '', btoaImpl, TextEncoderImpl });
  }

  const resp = await fetchImpl(`/api/session?id=${encodeURIComponent(sessionId)}&paginate=1`, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(resp.status === 404 ? t('session.notFound') : t('session.loadFailed'));
  const data = await resp.json();
  const scratchpad = await loadScratchpad(data?.header?.cwd || '', { fetchImpl });
  return buildSessionPageState({ sessionId, data, scratchpad, btoaImpl, TextEncoderImpl });
}
