// Per-message DOM/clipboard actions for the message pane (download JSONL, build
// a share URL, copy to clipboard). Extracted from session-entry-renderer.js
// during its decomposition into Svelte components. These are utilities, not view
// rendering — the live content runtime + export wire them to the delegated
// copy/download controls.

import { setIconElement, Check } from '../../shared/icons.js';

// Download the session as JSONL: header line + entry lines.
export function downloadSessionJson({
  entries = [],
  header = null,
  documentImpl = document,
  URLImpl = URL,
  BlobImpl = Blob,
} = {}) {
  const lines = [];
  if (header) lines.push(JSON.stringify({ type: 'header', ...header }));
  for (const entry of entries) lines.push(JSON.stringify(entry));
  const blob = new BlobImpl([lines.join('\n')], { type: 'application/x-ndjson' });
  const url = URLImpl.createObjectURL(blob);
  const a = documentImpl.createElement('a');
  a.href = url;
  a.download = `${header?.id || 'session'}.jsonl`;
  documentImpl.body.appendChild(a);
  a.click();
  documentImpl.body.removeChild(a);
  URLImpl.revokeObjectURL(url);
}

// Build a shareable URL for a message: base?gistId&leafId=<leaf>&targetId=<entry>.
export function buildShareUrl(entryId, {
  documentImpl = document,
  windowImpl = window,
  getCurrentLeafId = () => '',
  URLImpl = URL,
} = {}) {
  const baseUrlMeta = documentImpl.querySelector('meta[name="pi-share-base-url"]');
  const baseUrl = baseUrlMeta ? baseUrlMeta.content : windowImpl.location.href.split('?')[0];

  const url = new URLImpl(windowImpl.location.href);
  // The gist id is the first query param without a value (e.g. ?abc123).
  const gistId = Array.from(url.searchParams.keys()).find((k) => !url.searchParams.get(k));

  const params = new URLSearchParams();
  const sessionId = url.searchParams.get('id');
  if (sessionId) params.set('id', sessionId);
  params.set('leafId', getCurrentLeafId());
  params.set('targetId', entryId);

  if (baseUrlMeta) return `${baseUrl}&${params.toString()}`;
  url.search = gistId ? `?${gistId}&${params.toString()}` : `?${params.toString()}`;
  return url.toString();
}

// Copy text to the clipboard (with an execCommand fallback for HTTP) and flash
// the button with a check icon.
export async function copyToClipboard(text, button, {
  documentImpl = document,
  navigatorImpl = navigator,
} = {}) {
  let success = false;
  try {
    if (navigatorImpl.clipboard && navigatorImpl.clipboard.writeText) {
      await navigatorImpl.clipboard.writeText(text);
      success = true;
    }
  } catch { /* fall through to execCommand */ }

  if (!success) {
    try {
      const textarea = documentImpl.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      documentImpl.body.appendChild(textarea);
      textarea.select();
      success = documentImpl.execCommand('copy');
      documentImpl.body.removeChild(textarea);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy:', err);
    }
  }

  if (success && button) {
    const originalChildren = Array.from(button.childNodes).map((node) => node.cloneNode(true));
    setIconElement(button, Check, { size: 13, documentImpl });
    button.classList.add('copied');
    setTimeout(() => {
      button.replaceChildren(...originalChildren.map((node) => node.cloneNode(true)));
      button.classList.remove('copied');
    }, 1500);
  }
}
