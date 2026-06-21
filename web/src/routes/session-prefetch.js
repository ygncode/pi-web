// In-memory prefetch cache for /api/session payloads, used by SessionCard hover
// to start the request before the route actually mounts. loadSessionPageState
// consumes the in-flight promise instead of issuing a fresh fetch when present.
//
// Bounded so a long-running SPA session can't accumulate stale entries; only
// holds Promises, never the resolved payload, so a hit fed straight from the
// network is still fresh by the time the route mounts.

const inflight = new Map();
const MAX_ENTRIES = 16;

export function prefetchSession(id, { fetchImpl = fetch } = {}) {
  if (!id || inflight.has(id)) return;
  if (inflight.size >= MAX_ENTRIES) {
    const oldest = inflight.keys().next().value;
    if (oldest) inflight.delete(oldest);
  }
  const promise = fetchImpl(`/api/session?id=${encodeURIComponent(id)}&paginate=1`, {
    headers: { Accept: 'application/json' },
  })
    .then((resp) => {
      if (!resp.ok) {
        inflight.delete(id);
        throw new Error(resp.status === 404 ? 'not found' : 'load failed');
      }
      return resp.json();
    })
    .catch((err) => {
      inflight.delete(id);
      throw err;
    });
  // Swallow uncaught-rejection warnings: consumeSessionPrefetch handlers add a
  // proper catcher when they read this back.
  promise.catch(() => {});
  inflight.set(id, promise);
}

export function consumeSessionPrefetch(id) {
  if (!id) return null;
  const promise = inflight.get(id);
  if (!promise) return null;
  inflight.delete(id);
  return promise;
}

export function resetSessionPrefetch() {
  inflight.clear();
}
