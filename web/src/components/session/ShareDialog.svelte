<script>
  // Share dialog — Svelte port of live/share-overlay.js. Wires the hidden
  // #share-btn relay (in SessionHeader) to POST /share, then shows the gist /
  // preview URLs (or an error) in a reactive overlay with copy-to-clipboard.
  // Live-only (the export snapshot omits #share-btn). See svelte-migration-plan.
  import { onMount } from 'svelte';
  import { icon, Share2 } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';

  let { sessionId = '' } = $props();

  let open = $state(false);
  let isError = $state(false);
  let title = $state('Share session');
  let gistUrl = $state('');
  let previewUrl = $state('');
  let errorMsg = $state('');
  let overlayEl = $state(null);

  let copyNoticeTimer = null;

  function showShareCopiedNotice(label, text) {
    const notice = document.getElementById('share-copy-notice');
    if (!notice) return;
    notice.textContent = t('share.copiedSuffix', { label });
    notice.title = text;
    clearTimeout(copyNoticeTimer);
    notice.classList.add('visible');
    copyNoticeTimer = setTimeout(() => notice.classList.remove('visible'), 1200);
  }

  // Copy with a clipboard guard + execCommand fallback for insecure contexts.
  function copyShareUrl(text, label) {
    function fallbackCopy() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) showShareCopiedNotice(label, text);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showShareCopiedNotice(label, text)).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function close() { open = false; }

  onMount(() => {
    const shareBtn = document.getElementById('share-btn');
    const onShare = () => {
      shareBtn.innerHTML = '<span class="working-dots"></span>';
      shareBtn.disabled = true;
      fetch('/share?id=' + encodeURIComponent(sessionId), { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          shareBtn.innerHTML = icon(Share2, { size: 14 }) + 'Share';
          shareBtn.disabled = false;
          if (data.error) {
            isError = true;
            title = 'Share Failed';
            errorMsg = data.error + (data.stderr ? '\n\n' + data.stderr : '');
          } else {
            isError = false;
            title = 'Session Shared';
            gistUrl = data.gistUrl;
            previewUrl = data.previewUrl;
          }
          open = true;
        })
        .catch((err) => {
          shareBtn.innerHTML = icon(Share2, { size: 14 }) + 'Share';
          shareBtn.disabled = false;
          isError = true;
          title = 'Share Failed';
          errorMsg = err.message || 'Network error';
          open = true;
        });
    };
    const onKey = (e) => { if (e.key === 'Escape' && open) close(); };
    const onBackdrop = (e) => { if (e.target === overlayEl) close(); };

    shareBtn?.addEventListener('click', onShare);
    document.addEventListener('keydown', onKey);
    overlayEl?.addEventListener('click', onBackdrop);
    return () => {
      shareBtn?.removeEventListener('click', onShare);
      document.removeEventListener('keydown', onKey);
      overlayEl?.removeEventListener('click', onBackdrop);
      clearTimeout(copyNoticeTimer);
    };
  });
</script>

<div id="share-overlay" class="share-overlay-backdrop" style:display={open ? '' : 'none'} bind:this={overlayEl}>
  <div id="share-dialog" class="share-dialog" class:error={isError}>
    <h3 id="share-title">{title}</h3>
    <div id="share-fields" style:display={isError ? 'none' : ''}>
      <div class="share-field"><label for="share-gist-url">Gist URL</label><input id="share-gist-url" readonly class="share-url-input" value={gistUrl}></div>
      <div class="share-field"><label for="share-preview-url">Preview URL</label><input id="share-preview-url" readonly class="share-url-input" value={previewUrl}></div>
    </div>
    <p id="share-error-message" class="share-error-message" style:display={isError ? '' : 'none'}>{errorMsg}</p>
    <div class="share-actions">
      <button id="share-copy-gist" class="share-btn-primary" style:display={isError ? 'none' : ''} onclick={() => copyShareUrl(gistUrl, 'Gist')}>Copy Gist</button>
      <button id="share-copy-preview" class="share-btn-secondary" style:display={isError ? 'none' : ''} onclick={() => copyShareUrl(previewUrl, 'Preview')}>Copy Preview</button>
      <button id="share-close" class="share-btn-secondary" onclick={close}>Close</button>
    </div>
  </div>
</div>
<div id="share-copy-notice" class="toast-notice"></div>
