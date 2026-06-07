<script>
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { safeMarkedParse } from '../../session/render/markdown.js';
  import { t } from '../../shared/i18n.js';

  // `highlight`/`renderMarkdown` are injectable for tests; in the live app the
  // component lazy-loads highlight.js itself and renders markdown via marked.
  let { highlight = null, renderMarkdown = null } = $props();

  let artifacts = $state([]);
  let selectedId = $state('');
  let hiddenCount = $state(0);
  // Preview is opt-in (click-to-run): never auto-execute artifact content.
  let previewing = $state(false);
  let loadedHljs = $state(null);

  const selected = $derived(artifacts.find((a) => a.id === selectedId) || null);
  const noun = $derived(hiddenCount === 1 ? t('artifact.nounOne') : t('artifact.nounMany'));

  const effectiveHighlight = $derived(
    highlight ||
      (loadedHljs
        ? (code, lang) => {
            try {
              return lang && loadedHljs.getLanguage(lang)
                ? loadedHljs.highlight(code, { language: lang }).value
                : loadedHljs.highlightAuto(code).value;
            } catch {
              return null;
            }
          }
        : null),
  );

  // Highlighted HTML for the selected artifact's source, or null (→ plain text +
  // data-highlight-pending so the session's lazy highlighter can finish later).
  const codeHtml = $derived.by(() => {
    const a = selected;
    if (!a || !effectiveHighlight) return null;
    try {
      return effectiveHighlight(a.content, a.lang);
    } catch {
      return null;
    }
  });

  const renderMd = (text) => (renderMarkdown ? renderMarkdown(text) : safeMarkedParse(text, { marked }));

  function previewSrcdoc(a) {
    const csp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'";
    return `<!doctype html><html><head><meta charset="utf-8">`
      + `<meta http-equiv="Content-Security-Policy" content="${csp}">`
      + `</head><body>${a.content}</body></html>`;
  }

  const previewLabel = $derived.by(() => {
    if (previewing) return t('artifact.showSource');
    return selected?.previewType === 'markdown' ? t('artifact.preview') : t('artifact.runPreview');
  });

  async function copyToClipboard(textValue, button) {
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textValue);
        ok = true;
      }
    } catch { /* fall through to execCommand */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = textValue;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { /* give up silently */ }
    }
    if (ok && button) {
      const original = button.textContent;
      button.textContent = t('common.copied');
      button.classList.add('copied');
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove('copied');
      }, 1500);
    }
    return ok;
  }

  function download(a) {
    const blob = new Blob([a.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = a.filePath ? a.title : `${a.id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function setArtifacts(next, { hiddenCount: hidden = 0 } = {}) {
    artifacts = Array.isArray(next) ? next : [];
    hiddenCount = Number.isFinite(hidden) && hidden > 0 ? hidden : 0;
    if (!artifacts.some((a) => a.id === selectedId)) {
      selectedId = artifacts.length > 0 ? artifacts[0].id : '';
      previewing = false;
    }
  }

  function selectArtifact(id) {
    if (!artifacts.some((a) => a.id === id)) return;
    if (id !== selectedId) previewing = false;
    selectedId = id;
  }

  onMount(() => {
    if (!highlight) {
      import('highlight.js').then(({ default: loaded }) => { loadedHljs = loaded; }).catch(() => {});
    }
    window.__piArtifactPanel = {
      setArtifacts,
      selectArtifact,
      render: () => {},
      getSelectedId: () => selectedId,
      getArtifact: (id) => artifacts.find((a) => a.id === id) || null,
      getCount: () => artifacts.length,
    };
    return () => { delete window.__piArtifactPanel; };
  });
</script>

<div id="artifact-panel-host" class="artifact-panel-host">
  <div class="artifact-panel">
    {#if artifacts.length === 0}
      {#if hiddenCount > 0}
        <div class="artifact-empty">{@html t('artifact.emptyHidden', { count: hiddenCount, noun })}</div>
      {:else}
        <div class="artifact-empty">{t('artifact.emptyNone')}</div>
      {/if}
    {:else}
      <div class="artifact-list" role="tablist">
        {#each artifacts as a (a.id)}
          <button
            type="button"
            class="artifact-list-item"
            class:active={a.id === selectedId}
            role="tab"
            aria-selected={a.id === selectedId}
            data-artifact-id={a.id}
            onclick={() => selectArtifact(a.id)}
          >
            <span class="artifact-item-title">{a.title}</span>
            {#if a.lang}<span class="artifact-item-lang">{a.lang}</span>{/if}
            {#if a.kind === 'preview'}<span class="artifact-badge">preview</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    <div class="artifact-view">
      {#if selected}
        <div class="artifact-view-header">
          <span class="artifact-view-title">{selected.title}</span>
          <div class="artifact-view-actions">
            {#if selected.kind === 'preview'}
              <button type="button" class="artifact-action" class:active={previewing} data-action="toggle-preview" onclick={() => (previewing = !previewing)}>{previewLabel}</button>
            {/if}
            <button type="button" class="artifact-action" data-action="copy" title={t('artifact.copySource')} onclick={(e) => copyToClipboard(selected.content, e.currentTarget)}>{t('artifact.copy')}</button>
            <button type="button" class="artifact-action" data-action="download" title={t('artifact.download')} onclick={() => download(selected)}>{t('artifact.download')}</button>
          </div>
        </div>
        {#if selected.kind === 'preview' && previewing}
          {#if selected.previewType === 'markdown'}
            <div class="artifact-view-body"><div class="artifact-markdown markdown-content">{@html renderMd(selected.content)}</div></div>
          {:else}
            <div class="artifact-view-body"><iframe class="artifact-preview" sandbox="allow-scripts" referrerpolicy="no-referrer" title={`Preview: ${selected.title}`} srcdoc={previewSrcdoc(selected)}></iframe></div>
          {/if}
        {:else}
          <div class="artifact-view-body">
            <pre class="artifact-source" id={`artifact-${selected.id}`}>{#if codeHtml !== null}<code class="hljs">{@html codeHtml}</code>{:else}<code class="hljs" data-highlight-pending data-lang={selected.lang || undefined}>{selected.content}</code>{/if}</pre>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>
