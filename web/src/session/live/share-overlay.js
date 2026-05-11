function closeOverlay(state) {
  if (state.shareOverlay) state.shareOverlay.remove();
  state.shareOverlay = null;
}

function createOverlay(state, { documentImpl }) {
  closeOverlay(state);
  const overlay = documentImpl.createElement('div');
  state.shareOverlay = overlay;
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:300;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay(state);
  });
  return overlay;
}

export function showShareCopiedNotice(label, text, state, { documentImpl = document, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  let notice = documentImpl.getElementById('share-copy-notice');
  if (!notice) {
    notice = documentImpl.createElement('div');
    notice.id = 'share-copy-notice';
    notice.style.cssText = 'position:fixed;top:8px;right:8px;z-index:400;padding:2px 8px;font-size:10px;font-family:inherit;background:var(--accent);color:var(--body-bg);border-radius:3px;opacity:0;transition:opacity 0.3s;';
    documentImpl.body.appendChild(notice);
  }
  notice.textContent = label + ' copied';
  notice.title = text;
  clearTimeoutImpl(state.shareCopyHideTimer);
  notice.style.opacity = '1';
  state.shareCopyHideTimer = setTimeoutImpl(() => { notice.style.opacity = '0'; }, 1200);
}

export function copyShareUrl(text, label, state, { documentImpl = document, navigatorImpl = navigator, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  function fallbackCopy() {
    const textarea = documentImpl.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    documentImpl.body.appendChild(textarea);
    textarea.select();
    const ok = documentImpl.execCommand('copy');
    documentImpl.body.removeChild(textarea);
    if (ok) showShareCopiedNotice(label, text, state, { documentImpl, setTimeoutImpl, clearTimeoutImpl });
  }
  if (navigatorImpl.clipboard && navigatorImpl.clipboard.writeText) {
    navigatorImpl.clipboard.writeText(text).then(() => showShareCopiedNotice(label, text, state, { documentImpl, setTimeoutImpl, clearTimeoutImpl })).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

export function showShareResult(gistUrl, previewUrl, state, { documentImpl = document, escapeHtml = String, navigatorImpl = navigator, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  const overlay = createOverlay(state, { documentImpl });
  const box = documentImpl.createElement('div');
  box.style.cssText = 'background:var(--container-bg);border:1px solid var(--dim);border-radius:4px;padding:calc(var(--line-height)*2);max-width:500px;width:90%;font-family:inherit;';
  box.innerHTML = '<h3 style="margin:0 0 var(--line-height);font-size:12px;color:var(--border-accent);">Session Shared</h3>' +
    '<div style="margin-bottom:var(--line-height);"><label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">Gist URL</label>' +
    '<input readonly value="' + escapeHtml(gistUrl) + '" style="width:100%;padding:4px 8px;font-size:11px;font-family:inherit;background:var(--body-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;" onclick="this.select()"></div>' +
    '<div style="margin-bottom:var(--line-height);"><label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">Preview URL</label>' +
    '<input readonly value="' + escapeHtml(previewUrl) + '" style="width:100%;padding:4px 8px;font-size:11px;font-family:inherit;background:var(--body-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;" onclick="this.select()"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
    '<button id="share-copy-gist" style="padding:4px 10px;font-size:11px;font-family:inherit;background:var(--accent);color:var(--body-bg);border:none;border-radius:3px;cursor:pointer;">Copy Gist</button>' +
    '<button id="share-copy-preview" style="padding:4px 10px;font-size:11px;font-family:inherit;background:var(--container-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;">Copy Preview</button>' +
    '<button id="share-close" style="padding:4px 10px;font-size:11px;font-family:inherit;background:var(--container-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;">Close</button></div>';
  overlay.appendChild(box);
  documentImpl.body.appendChild(overlay);
  documentImpl.getElementById('share-close').addEventListener('click', () => closeOverlay(state));
  documentImpl.getElementById('share-copy-gist').addEventListener('click', () => copyShareUrl(gistUrl, 'Gist', state, { documentImpl, navigatorImpl, setTimeoutImpl, clearTimeoutImpl }));
  documentImpl.getElementById('share-copy-preview').addEventListener('click', () => copyShareUrl(previewUrl, 'Preview', state, { documentImpl, navigatorImpl, setTimeoutImpl, clearTimeoutImpl }));
}

export function showShareError(message, state, { documentImpl = document, escapeHtml = String } = {}) {
  const overlay = createOverlay(state, { documentImpl });
  const box = documentImpl.createElement('div');
  box.style.cssText = 'background:var(--container-bg);border:1px solid var(--error);border-radius:4px;padding:calc(var(--line-height)*2);max-width:400px;width:90%;font-family:inherit;';
  box.innerHTML = '<h3 style="margin:0 0 var(--line-height);font-size:12px;color:var(--error);">Share Failed</h3>' +
    '<p style="font-size:11px;color:var(--text);margin:0 0 var(--line-height);white-space:pre-wrap;">' + escapeHtml(message) + '</p>' +
    '<div style="display:flex;justify-content:flex-end;"><button id="share-close-err" style="padding:4px 10px;font-size:11px;font-family:inherit;background:var(--container-bg);color:var(--text);border:1px solid var(--dim);border-radius:3px;cursor:pointer;">Close</button></div>';
  overlay.appendChild(box);
  documentImpl.body.appendChild(overlay);
  documentImpl.getElementById('share-close-err').addEventListener('click', () => closeOverlay(state));
}

export function setupShareButton({ documentImpl = document, fetchImpl = fetch, sessionId, state, escapeHtml = String, navigatorImpl = navigator } = {}) {
  const shareBtn = documentImpl.getElementById('share-btn');
  if (!shareBtn) return false;
  shareBtn.addEventListener('click', () => {
    shareBtn.textContent = '...';
    shareBtn.disabled = true;
    fetchImpl('/share?id=' + encodeURIComponent(sessionId), { method: 'POST' })
      .then((response) => response.json())
      .then((data) => {
        shareBtn.textContent = '↗ Share';
        shareBtn.disabled = false;
        if (data.error) showShareError(data.error + (data.stderr ? '\n\n' + data.stderr : ''), state, { documentImpl, escapeHtml });
        else showShareResult(data.gistUrl, data.previewUrl, state, { documentImpl, escapeHtml, navigatorImpl });
      })
      .catch((err) => {
        shareBtn.textContent = '↗ Share';
        shareBtn.disabled = false;
        showShareError(err.message || 'Network error', state, { documentImpl, escapeHtml });
      });
  });
  return true;
}
