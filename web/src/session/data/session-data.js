export function decodeBase64JSON(base64, { atobImpl = globalThis.atob, TextDecoderImpl = globalThis.TextDecoder } = {}) {
  if (typeof base64 !== 'string') {
    throw new TypeError('base64 payload must be a string');
  }
  if (typeof atobImpl !== 'function') {
    throw new Error('atob is unavailable');
  }
  const binary = atobImpl(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return JSON.parse(new TextDecoderImpl('utf-8').decode(bytes));
}

export function readSessionPayload({ documentImpl = document, atobImpl = globalThis.atob } = {}) {
  const el = documentImpl.getElementById('session-data');
  if (!el) {
    throw new Error('missing #session-data element');
  }
  return decodeBase64JSON(el.textContent || '', { atobImpl });
}

export function getSessionSearchParams({ documentImpl = document, windowImpl = window } = {}) {
  const injectedParams = documentImpl.querySelector('meta[name="pi-url-params"]');
  const searchString = injectedParams ? injectedParams.content : (windowImpl.location?.search || '').replace(/^\?/, '');
  return new URLSearchParams(searchString);
}

export function buildSessionLookups(entries = []) {
  const byId = new Map();
  const toolCallMap = new Map();
  const labelMap = new Map();

  for (const entry of entries) {
    if (entry?.id) byId.set(entry.id, entry);

    if (entry?.type === 'message' && entry.message?.role === 'assistant' && Array.isArray(entry.message.content)) {
      for (const block of entry.message.content) {
        if (block?.type === 'toolCall') {
          toolCallMap.set(block.id, { name: block.name, arguments: block.arguments });
        }
      }
    }

    if (entry?.type === 'label' && entry.targetId && entry.label) {
      labelMap.set(entry.targetId, entry.label);
    }
  }

  return { byId, toolCallMap, labelMap };
}

export function createSessionDataModel(payload, params = new URLSearchParams()) {
  const header = payload?.header || {};
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  const defaultLeafId = payload?.leafId || '';
  const urlLeafId = params.get('leafId');
  const urlTargetId = params.get('targetId');

  // Pagination metadata for huge sessions. When the server embeds only a
  // tail window, `total` is the full entry count, `from` is the index in the
  // full session where the embedded slice starts, and `truncated` is true
  // when from > 0. Small sessions don't include these fields — defaults
  // make the model behave as before.
  const total = Number.isInteger(payload?.total) ? payload.total : entries.length;
  const from = Number.isInteger(payload?.from) ? payload.from : 0;
  const truncated = Boolean(payload?.truncated) || from > 0 || entries.length < total;

  return {
    payload,
    params,
    header,
    entries,
    defaultLeafId,
    leafId: urlLeafId || defaultLeafId,
    urlLeafId,
    urlTargetId,
    systemPrompt: payload?.systemPrompt ?? null,
    tools: payload?.tools ?? null,
    renderedTools: payload?.renderedTools ?? null,
    total,
    from,
    truncated,
    ...buildSessionLookups(entries)
  };
}

export function loadSessionData(options = {}) {
  const payload = readSessionPayload(options);
  const params = getSessionSearchParams(options);
  return createSessionDataModel(payload, params);
}
