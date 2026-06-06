import { icon, Share2 } from '../../shared/icons.js';
import { t } from '../../shared/i18n.js';

export function hideShareOverlay(state, { documentImpl = document } = {}) {
  const overlay = documentImpl.getElementById('share-overlay');
  if (overlay) overlay.style.display = 'none';
  state.shareOverlay = null;
}

export function showShareCopiedNotice(label, text, state, { documentImpl = document, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  const notice = documentImpl.getElementById('share-copy-notice');
  if (!notice) return;
  notice.textContent = t('share.copiedSuffix', { label });
  notice.title = text;
  clearTimeoutImpl(state.shareCopyHideTimer);
  notice.classList.add('visible');
  state.shareCopyHideTimer = setTimeoutImpl(() => { notice.classList.remove('visible'); }, 1200);
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
    navigatorImpl.clipboard.writeText(text)
      .then(() => showShareCopiedNotice(label, text, state, { documentImpl, setTimeoutImpl, clearTimeoutImpl }))
      .catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

export function showShareResult(gistUrl, previewUrl, state, { documentImpl = document } = {}) {
  const overlay = documentImpl.getElementById('share-overlay');
  const dialog = documentImpl.getElementById('share-dialog');
  if (!overlay || !dialog) return;

  dialog.classList.remove('error');
  documentImpl.getElementById('share-title').textContent = 'Session Shared';
  documentImpl.getElementById('share-fields').style.display = '';
  documentImpl.getElementById('share-error-message').style.display = 'none';
  documentImpl.getElementById('share-copy-gist').style.display = '';
  documentImpl.getElementById('share-copy-preview').style.display = '';

  documentImpl.getElementById('share-gist-url').value = gistUrl;
  documentImpl.getElementById('share-preview-url').value = previewUrl;
  documentImpl.getElementById('share-copy-gist').dataset.url = gistUrl;
  documentImpl.getElementById('share-copy-preview').dataset.url = previewUrl;

  overlay.style.display = '';
  state.shareOverlay = overlay;
}

export function showShareError(message, state, { documentImpl = document, escapeHtml = String } = {}) {
  const overlay = documentImpl.getElementById('share-overlay');
  const dialog = documentImpl.getElementById('share-dialog');
  if (!overlay || !dialog) return;

  dialog.classList.add('error');
  documentImpl.getElementById('share-title').textContent = 'Share Failed';
  documentImpl.getElementById('share-fields').style.display = 'none';
  const errEl = documentImpl.getElementById('share-error-message');
  errEl.style.display = '';
  errEl.textContent = message;
  documentImpl.getElementById('share-copy-gist').style.display = 'none';
  documentImpl.getElementById('share-copy-preview').style.display = 'none';

  overlay.style.display = '';
  state.shareOverlay = overlay;
}

export function setupShareButton({ documentImpl = document, fetchImpl = fetch, sessionId, state, escapeHtml = String, navigatorImpl = navigator } = {}) {
  const shareBtn = documentImpl.getElementById('share-btn');
  const overlay = documentImpl.getElementById('share-overlay');
  if (!shareBtn || !overlay) return false;

  if (!state.__shareListenersBound) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideShareOverlay(state, { documentImpl });
    });
    const closeBtn = documentImpl.getElementById('share-close');
    if (closeBtn) closeBtn.addEventListener('click', () => hideShareOverlay(state, { documentImpl }));

    const copyGistBtn = documentImpl.getElementById('share-copy-gist');
    if (copyGistBtn) {
      copyGistBtn.addEventListener('click', () => {
        const url = copyGistBtn.dataset.url;
        if (url) copyShareUrl(url, copyGistBtn.dataset.copyLabel || 'Gist', state, { documentImpl, navigatorImpl });
      });
    }
    const copyPreviewBtn = documentImpl.getElementById('share-copy-preview');
    if (copyPreviewBtn) {
      copyPreviewBtn.addEventListener('click', () => {
        const url = copyPreviewBtn.dataset.url;
        if (url) copyShareUrl(url, copyPreviewBtn.dataset.copyLabel || 'Preview', state, { documentImpl, navigatorImpl });
      });
    }
    state.__shareListenersBound = true;
  }

  shareBtn.addEventListener('click', () => {
    shareBtn.innerHTML = '<span class="working-dots"></span>';
    shareBtn.disabled = true;
    fetchImpl('/share?id=' + encodeURIComponent(sessionId), { method: 'POST' })
      .then((response) => response.json())
      .then((data) => {
        shareBtn.innerHTML = icon(Share2, { size: 14 }) + 'Share';
        shareBtn.disabled = false;
        if (data.error) {
          showShareError(data.error + (data.stderr ? '\n\n' + data.stderr : ''), state, { documentImpl, escapeHtml });
        } else {
          showShareResult(data.gistUrl, data.previewUrl, state, { documentImpl });
        }
      })
      .catch((err) => {
        shareBtn.innerHTML = icon(Share2, { size: 14 }) + 'Share';
        shareBtn.disabled = false;
        showShareError(err.message || 'Network error', state, { documentImpl, escapeHtml });
      });
  });
  return true;
}
