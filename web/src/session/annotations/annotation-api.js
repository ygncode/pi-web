/**
 * annotation-api.js — thin client for the /api/annotations endpoint.
 * Annotations are keyed by session id and persisted server-side (SQLite).
 */
export function createAnnotationApi({ sessionId, fetchImpl = fetch } = {}) {
  const base = `/api/annotations?session=${encodeURIComponent(sessionId)}`;

  async function list() {
    const res = await fetchImpl(base);
    if (!res.ok) throw new Error(`list annotations: HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.annotations) ? data.annotations : [];
  }

  async function create(annotation) {
    const res = await fetchImpl(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation)
    });
    if (!res.ok) throw new Error(`create annotation: HTTP ${res.status}`);
    const data = await res.json();
    return data.annotation;
  }

  async function remove(id) {
    const res = await fetchImpl(`${base}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`delete annotation: HTTP ${res.status}`);
    return true;
  }

  return { list, create, remove };
}
