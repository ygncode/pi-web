// Pure helpers for the per-message footer (copy / rating / permalink / files).
import { getJSON, postJSON } from '../../shared/api.js';

const DONE = /^(stop|end_turn|endTurn|length)$/;

// finalText returns the assistant's markdown output for a finished message
// (text blocks only — no reasoning, no tool calls). '' when not finished.
export function finalText(msg) {
  if (!msg || msg.role !== 'assistant' || !Array.isArray(msg.content)) return '';
  if (msg.stopReason && !DONE.test(msg.stopReason)) return '';
  return msg.content
    .filter((b) => b?.type === 'text' && typeof b.text === 'string' && b.text.trim())
    .map((b) => b.text.trim())
    .join('\n\n');
}

export function shortTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const lines = (t) => (typeof t === 'string' && t.length ? t.split('\n').length : 0);

function fileOp(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'write' || n === 'write_file' || n === 'create') return 'write';
  if (n === 'edit' || n === 'multiedit' || n === 'str_replace' || n === 'apply_patch')
    return 'edit';
  return '';
}

// turnFiles walks back from an assistant entry to the user message that
// started the turn and summarises every write/edit tool call, per file.
export function turnFiles(entry, entries) {
  if (!Array.isArray(entries) || !entry) return { files: [], added: 0, removed: 0 };
  let idx = entries.indexOf(entry);
  if (idx < 0 && entry.id) idx = entries.findIndex((e) => e?.id === entry.id);
  if (idx < 0) return { files: [], added: 0, removed: 0 };
  const results = new Map();
  const byPath = new Map();
  for (let i = idx; i >= 0; i--) {
    const e = entries[i];
    if (e?.type !== 'message') continue;
    const m = e.message;
    if (i !== idx && m?.role === 'user') break;
    if (m?.role === 'toolResult') results.set(m.toolCallId, e);
    if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue;
    for (const [bi, b] of m.content.entries()) {
      if (b?.type !== 'toolCall') continue;
      const op = fileOp(b.name);
      const a = b.arguments || {};
      const path = a.path || a.file_path || a.filePath;
      if (!op || !path) continue;
      const res = results.get(b.id);
      if (res?.message?.isError) continue;
      let add = 0;
      let del = 0;
      if (op === 'write') add = lines(a.content);
      else {
        const edits = Array.isArray(a.edits)
          ? a.edits
          : [{ oldText: a.oldText ?? a.old_string, newText: a.newText ?? a.new_string }];
        for (const ed of edits) {
          del += lines(ed?.oldText);
          add += lines(ed?.newText);
        }
      }
      const cur = byPath.get(path) || {
        path,
        name: path.split(/[\\/]/).pop(),
        ext: (path.split('.').pop() || '').toUpperCase(),
        op,
        added: 0,
        removed: 0,
        anchor: res ? `entry-${res.id}` : '',
        order: i * 1000 + bi,
      };
      cur.order = Math.min(cur.order, i * 1000 + bi);
      if (op === 'write' && cur.op === 'edit') cur.op = 'write';
      cur.added += add;
      cur.removed += del;
      byPath.set(path, cur);
    }
  }
  const files = [...byPath.values()].sort((a, b) => a.order - b.order);
  for (const f of files) if (f.ext.length > 6 || !f.name.includes('.')) f.ext = 'ARQ';
  return {
    files,
    added: files.reduce((n, f) => n + f.added, 0),
    removed: files.reduce((n, f) => n + f.removed, 0),
  };
}

export function currentSessionId(loc = globalThis.location) {
  try {
    return new URLSearchParams(loc?.search || '').get('id') || '';
  } catch {
    return '';
  }
}

export function permalink(entryId, loc = globalThis.location) {
  const id = currentSessionId(loc);
  if (!loc || !id) return '';
  return `${loc.origin}/session?id=${encodeURIComponent(id)}#entry-${entryId}`;
}

// Ratings are cached per session so each footer does not refetch.
const ratingCache = new Map();
export function loadRatings(sessionId, load = (u) => getJSON(u)) {
  if (!sessionId) return Promise.resolve({});
  if (!ratingCache.has(sessionId)) {
    ratingCache.set(
      sessionId,
      load('/api/message-rating?id=' + encodeURIComponent(sessionId))
        .then((d) => d?.ratings || {})
        .catch(() => ({})),
    );
  }
  return ratingCache.get(sessionId);
}

export function saveRating(sessionId, entryId, rating, post = postJSON) {
  ratingCache.delete(sessionId);
  return post('/api/message-rating?id=' + encodeURIComponent(sessionId), { entryId, rating });
}

export function _resetRatingCache() {
  ratingCache.clear();
}

// ── Retry / regenerate ────────────────────────────────────────────────────
// pi has no "regenerate" RPC, so retry = fork the session just before the
// user prompt that produced this answer and re-send that prompt in the fork.
// The original branch stays untouched (good for LoRA: both answers survive).

function userText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('');
}

/** Find the user prompt behind an assistant entry: {text, forkAt} or null. */
export function retrySource(entry, entries = []) {
  if (!entry || !Array.isArray(entries)) return null;
  const byId = new Map();
  for (const e of entries) if (e?.id) byId.set(e.id, e);
  let cur = entry.parentId ? byId.get(entry.parentId) : null;
  for (let guard = 0; cur && guard < 10000; guard++) {
    const m = cur.type === 'message' ? cur.message : null;
    if (m?.role === 'user') {
      const text = userText(m.content).trim();
      if (!text || !cur.parentId || !byId.has(cur.parentId)) return null;
      return { text, forkAt: cur.parentId };
    }
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return null;
}

const RETRY_PREFIX = 'pi-web:retry:';

export function stashRetry(sessionId, text, store = globalThis.sessionStorage) {
  try {
    store?.setItem(RETRY_PREFIX + sessionId, text);
    return true;
  } catch {
    return false;
  }
}

/** Read-and-clear the pending retry prompt for a session ('' when none). */
export function takeRetry(sessionId, store = globalThis.sessionStorage) {
  try {
    const v = store?.getItem(RETRY_PREFIX + sessionId) || '';
    if (v) store.removeItem(RETRY_PREFIX + sessionId);
    return v;
  } catch {
    return '';
  }
}

export async function retryMessage(
  sessionId,
  src,
  {
    post = postJSON,
    store = globalThis.sessionStorage,
    go = (u) => globalThis.location.assign(u),
  } = {},
) {
  if (!sessionId || !src?.forkAt || !src.text) throw new Error('nada para refazer');
  const data = await post('/api/fork-session?id=' + encodeURIComponent(sessionId), {
    entryId: src.forkAt,
  });
  if (!data?.id) throw new Error(data?.error || 'falha ao criar o ramo');
  stashRetry(data.id, src.text, store);
  go('/session?id=' + encodeURIComponent(data.id));
  return data.id;
}
