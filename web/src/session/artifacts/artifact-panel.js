/**
 * artifact-panel.js — renders the artifact list + selected-artifact source view.
 *
 * Mounts into a host element (the right-sidebar "Artifacts" tab). Shows a list
 * of detected artifacts and, for the selected one, its syntax-highlighted
 * source with copy + download actions. Preview-kind artifacts (HTML/SVG) render
 * their source here too; the sandboxed live preview is a separate follow-up.
 *
 * Dependency-injected (documentImpl/windowImpl/...) for jsdom testability,
 * mirroring the shape of right-sidebar.js and session-entry-renderer.js.
 */

import { t } from '../../shared/i18n.js';

export function createArtifactPanel({
  host,
  escapeHtml,
  highlight = null, // (code, lang) => highlightedHtml | null
  renderMarkdown = null, // (markdownText) => sanitized HTML string
  documentImpl = document,
  windowImpl = window,
  navigatorImpl = navigator,
  URLImpl = URL,
  BlobImpl = Blob
} = {}) {
  if (!host) throw new Error('createArtifactPanel: host element is required');
  if (typeof escapeHtml !== 'function') throw new Error('createArtifactPanel: escapeHtml is required');

  let artifacts = [];
  let selectedId = '';
  // How many detected artifacts the active filter is hiding (for the empty state).
  let hiddenCount = 0;
  // Preview is opt-in (click-to-run): we never auto-execute artifact content on
  // load. Resets to false whenever the selected artifact changes.
  let previewing = false;

  function selected() {
    return artifacts.find(a => a.id === selectedId) || null;
  }

  // Render preview-kind content in an isolated iframe. sandbox="allow-scripts"
  // WITHOUT allow-same-origin gives the frame a unique opaque origin: it cannot
  // touch the parent DOM, cookies, localStorage, or the PI_WEB_TOKEN. The CSP
  // meta blocks all network access so previewed code can't exfiltrate. srcdoc is
  // set as a property (not concatenated into parent HTML) so there is no path for
  // the content to execute in the parent document.
  function buildPreviewFrame(artifact) {
    const csp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'";
    const doc = `<!doctype html><html><head><meta charset="utf-8">`
      + `<meta http-equiv="Content-Security-Policy" content="${csp}">`
      + `</head><body>${artifact.content}</body></html>`;
    const frame = documentImpl.createElement('iframe');
    frame.className = 'artifact-preview';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('title', `Preview: ${artifact.title}`);
    frame.srcdoc = doc;
    return frame;
  }

  // The source <pre> carries id="artifact-<id>" so it can be an annotation
  // anchor (offsets are measured against its text content).
  function renderCode(content, lang, artifactId) {
    let inner = null;
    if (highlight) {
      try { inner = highlight(content, lang); } catch { inner = null; }
    }
    const dataLang = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
    const pending = inner === null ? ` data-highlight-pending${dataLang}` : '';
    const idAttr = artifactId ? ` id="artifact-${escapeHtml(artifactId)}"` : '';
    return `<pre class="artifact-source"${idAttr}><code class="hljs"${pending}>${inner !== null ? inner : escapeHtml(content)}</code></pre>`;
  }

  function listHtml() {
    if (artifacts.length === 0) {
      if (hiddenCount > 0) {
        const noun = hiddenCount === 1 ? t('artifact.nounOne') : t('artifact.nounMany');
        return `<div class="artifact-empty">${t('artifact.emptyHidden', { count: hiddenCount, noun })}</div>`;
      }
      return `<div class="artifact-empty">${escapeHtml(t('artifact.emptyNone'))}</div>`;
    }
    let html = '<div class="artifact-list" role="tablist">';
    for (const a of artifacts) {
      const active = a.id === selectedId ? ' active' : '';
      const badge = a.kind === 'preview' ? '<span class="artifact-badge">preview</span>' : '';
      html += `<button type="button" class="artifact-list-item${active}" role="tab" aria-selected="${a.id === selectedId}" data-artifact-id="${escapeHtml(a.id)}">`;
      html += `<span class="artifact-item-title">${escapeHtml(a.title)}</span>`;
      if (a.lang) html += `<span class="artifact-item-lang">${escapeHtml(a.lang)}</span>`;
      html += badge;
      html += '</button>';
    }
    html += '</div>';
    return html;
  }

  function viewHtml() {
    const a = selected();
    if (!a) return '<div class="artifact-view"></div>';
    const isPreview = a.kind === 'preview';
    // 'markdown' renders inline (sanitized) so the label is a gentle "Preview";
    // executable html/svg keep the click-to-run "Run preview".
    const previewLabel = previewing ? t('artifact.showSource') : (a.previewType === 'markdown' ? t('artifact.preview') : t('artifact.runPreview'));
    const previewToggle = isPreview
      ? `<button type="button" class="artifact-action${previewing ? ' active' : ''}" data-action="toggle-preview">${previewLabel}</button>`
      : '';
    // When previewing, leave the body empty here; iframe/markdown is mounted via
    // DOM in render() (iframe srcdoc as a property; markdown as sanitized HTML).
    const body = (isPreview && previewing)
      ? '<div class="artifact-view-body"></div>'
      : `<div class="artifact-view-body">${renderCode(a.content, a.lang, a.id)}</div>`;
    return `<div class="artifact-view">
      <div class="artifact-view-header">
        <span class="artifact-view-title">${escapeHtml(a.title)}</span>
        <div class="artifact-view-actions">
          ${previewToggle}
          <button type="button" class="artifact-action" data-action="copy" title="${escapeHtml(t('artifact.copySource'))}">${escapeHtml(t('artifact.copy'))}</button>
          <button type="button" class="artifact-action" data-action="download" title="${escapeHtml(t('artifact.download'))}">${escapeHtml(t('artifact.download'))}</button>
        </div>
      </div>
      ${body}
    </div>`;
  }

  function render() {
    host.innerHTML = `<div class="artifact-panel">${listHtml()}${viewHtml()}</div>`;
    const a = selected();
    if (a && a.kind === 'preview' && previewing) {
      const body = host.querySelector('.artifact-view-body');
      if (body) {
        if (a.previewType === 'markdown') {
          const md = renderMarkdown ? renderMarkdown(a.content) : escapeHtml(a.content);
          body.innerHTML = `<div class="artifact-markdown markdown-content">${md}</div>`;
        } else {
          body.appendChild(buildPreviewFrame(a));
        }
      }
    }
    applyHighlightFallback();
  }

  // If hljs wasn't ready at render time, the <code> carries data-highlight-pending;
  // try once more now (the session's lazy highlighter may have loaded since).
  function applyHighlightFallback() {
    if (!highlight) return;
    host.querySelectorAll('code[data-highlight-pending]').forEach((el) => {
      const lang = el.dataset.lang;
      const code = el.textContent;
      let inner = null;
      try { inner = highlight(code, lang); } catch { inner = null; }
      if (inner !== null) {
        el.innerHTML = inner;
        el.removeAttribute('data-highlight-pending');
        el.removeAttribute('data-lang');
      }
    });
  }

  async function copyToClipboard(textValue, button) {
    let ok = false;
    try {
      if (navigatorImpl.clipboard && navigatorImpl.clipboard.writeText) {
        await navigatorImpl.clipboard.writeText(textValue);
        ok = true;
      }
    } catch { /* fall through to execCommand */ }
    if (!ok) {
      try {
        const ta = documentImpl.createElement('textarea');
        ta.value = textValue;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        documentImpl.body.appendChild(ta);
        ta.select();
        ok = documentImpl.execCommand('copy');
        documentImpl.body.removeChild(ta);
      } catch { /* give up silently */ }
    }
    if (ok && button) {
      const original = button.textContent;
      button.textContent = t('common.copied');
      button.classList.add('copied');
      windowImpl.setTimeout(() => {
        button.textContent = original;
        button.classList.remove('copied');
      }, 1500);
    }
    return ok;
  }

  function download(a) {
    const blob = new BlobImpl([a.content], { type: 'text/plain' });
    const url = URLImpl.createObjectURL(blob);
    const anchor = documentImpl.createElement('a');
    anchor.href = url;
    anchor.download = a.filePath ? a.title : `${a.id}.txt`;
    documentImpl.body.appendChild(anchor);
    anchor.click();
    documentImpl.body.removeChild(anchor);
    URLImpl.revokeObjectURL(url);
  }

  host.addEventListener('click', (e) => {
    const item = e.target.closest?.('.artifact-list-item');
    if (item && host.contains(item)) {
      selectArtifact(item.dataset.artifactId);
      return;
    }
    const action = e.target.closest?.('.artifact-action');
    if (action && host.contains(action)) {
      const a = selected();
      if (!a) return;
      if (action.dataset.action === 'copy') copyToClipboard(a.content, action);
      else if (action.dataset.action === 'download') download(a);
      else if (action.dataset.action === 'toggle-preview') {
        previewing = !previewing;
        render();
      }
    }
  });

  function setArtifacts(next, { hiddenCount: hidden = 0 } = {}) {
    artifacts = Array.isArray(next) ? next : [];
    hiddenCount = Number.isFinite(hidden) && hidden > 0 ? hidden : 0;
    if (!artifacts.some(a => a.id === selectedId)) {
      selectedId = artifacts.length > 0 ? artifacts[0].id : '';
      previewing = false;
    }
    render();
  }

  function selectArtifact(id) {
    if (!artifacts.some(a => a.id === id)) return;
    if (id !== selectedId) previewing = false;
    selectedId = id;
    render();
  }

  return {
    setArtifacts,
    selectArtifact,
    render,
    getSelectedId: () => selectedId,
    getArtifact: (id) => artifacts.find(a => a.id === id) || null,
    getCount: () => artifacts.length
  };
}
