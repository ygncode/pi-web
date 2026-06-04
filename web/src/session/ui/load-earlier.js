/**
 * load-earlier — "Load earlier messages" affordance for huge sessions.
 *
 * When the server embeds only the tail of a huge session in the initial HTML
 * payload (see `internal/ui/session_page.go:prepareSessionPageData` —
 * truncated/total/from fields), this module injects a banner above the
 * #messages container with a button that fetches preceding windows from
 * `/api/session?id=...&from=N&count=K` and merges them into the data model.
 *
 * The merge primitive (`syncDataModelEntries`) is owned by session.js;
 * we receive it as a dependency. We also receive the current dataModel by
 * reference so its `entries` / `total` / `from` stay live across loads.
 *
 * Design notes:
 * - Loads in WINDOW_SIZE chunks (default 500) to keep each round-trip
 *   responsive and the DOM-rebuild incremental.
 * - Disables the button + shows a spinner while a fetch is in-flight, so
 *   repeated clicks can't queue up overlapping requests.
 * - On error, surfaces the message in the banner and re-enables the button
 *   so the user can retry.
 * - When all entries are loaded (from === 0), removes the banner from the DOM.
 */

const WINDOW_SIZE = 500;

export function setupLoadEarlierBanner({
  dataModel,
  sessionId,
  syncDataModelEntries,
  documentImpl = document,
  fetchImpl = (typeof window !== 'undefined' ? window.fetch.bind(window) : null),
  windowSize = WINDOW_SIZE,
} = {}) {
  if (!dataModel || !dataModel.truncated || dataModel.from <= 0) return null;
  if (typeof syncDataModelEntries !== 'function') return null;
  if (typeof fetchImpl !== 'function') return null;

  const messagesEl = documentImpl.getElementById('messages');
  if (!messagesEl) return null;

  const banner = documentImpl.createElement('div');
  banner.id = 'load-earlier-banner';
  banner.className = 'load-earlier-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Earlier messages');

  const label = documentImpl.createElement('span');
  label.className = 'load-earlier-label';

  const button = documentImpl.createElement('button');
  button.type = 'button';
  button.className = 'load-earlier-button';

  const status = documentImpl.createElement('span');
  status.className = 'load-earlier-status';

  banner.appendChild(label);
  banner.appendChild(button);
  banner.appendChild(status);
  messagesEl.parentNode.insertBefore(banner, messagesEl);

  function updateLabel() {
    const shown = dataModel.entries.length;
    const total = dataModel.total;
    label.textContent = `Showing latest ${shown.toLocaleString()} of ${total.toLocaleString()} messages.`;
    const remaining = dataModel.from;
    const next = Math.min(windowSize, remaining);
    button.textContent = remaining > 0 ? `Load ${next.toLocaleString()} earlier` : 'All earlier loaded';
    button.disabled = remaining <= 0;
  }

  async function loadEarlier() {
    if (button.disabled) return;
    const requestFrom = Math.max(0, dataModel.from - windowSize);
    const requestCount = dataModel.from - requestFrom;
    button.disabled = true;
    status.textContent = 'Loading…';
    try {
      const url = `/api/session?id=${encodeURIComponent(sessionId)}&from=${requestFrom}&count=${requestCount}`;
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const earlier = Array.isArray(payload?.entries) ? payload.entries : [];
      if (earlier.length === 0) {
        // Server returned empty — treat as fully loaded.
        dataModel.from = 0;
        dataModel.truncated = false;
        status.textContent = '';
        updateLabel();
        if (dataModel.from === 0) banner.remove();
        return;
      }
      const merged = [...earlier, ...dataModel.entries];
      // syncDataModelEntries handles the full re-build: replaces entries,
      // rebuilds byId/toolCallMap/labelMap, re-renders the tree.
      syncDataModelEntries(merged);
      dataModel.from = requestFrom;
      dataModel.truncated = requestFrom > 0;
      status.textContent = '';
      updateLabel();
      if (requestFrom === 0) banner.remove();
    } catch (err) {
      const message = (err && err.message) ? err.message : String(err);
      status.textContent = `Failed to load: ${message}`;
      button.disabled = false;
    }
  }

  button.addEventListener('click', loadEarlier);
  updateLabel();

  return { banner, loadEarlier, refresh: updateLabel };
}
