<script>
  import { onMount, untrack } from 'svelte';
  import { marked } from 'marked';
  import { safeMarkedParse } from '../../session/render/markdown.js';
  import { getSessionModel } from '../../session/session-context.js';
  import { collectArtifacts } from '../../session/artifacts/artifact-registry.js';
  import { filterArtifacts, readArtifactSettings, ARTIFACT_SETTING_KEYS } from '../../session/artifacts/artifact-filter.js';
  import { t } from '../../shared/i18n.js';
  import { sessionRuntime } from '../../session/session-runtime.js';

  // `highlight`/`renderMarkdown` are injectable for tests; in the live app the
  // component lazy-loads highlight.js itself and renders markdown via marked.
  let { highlight = null, renderMarkdown = null } = $props();

  // The panel collects artifacts straight from the shared reactive model: on
  // mount and whenever entries change (live reload), it re-runs collection +
  // filtering. Standalone (tests, no context) the model is undefined and the
  // panel is driven imperatively via the sessionRuntime.artifacts.setArtifacts
  // handle instead.
  const model = getSessionModel();
  // Bumped by the cross-tab `storage` listener so the collection effect re-reads
  // the artifact settings (enable/include filter) without a reload.
  let settingsTick = $state(0);

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

  // Hide the Artifacts tab entirely when the feature is disabled; if it was the
  // active tab, fall back to Scratchpad so the user isn't left on a blank pane.
  function applyArtifactsEnabled(enabled) {
    const tab = document.getElementById('right-tab-artifacts');
    if (!tab) return;
    tab.hidden = !enabled;
    if (!enabled && tab.classList.contains('active')) {
      document.getElementById('right-tab-scratchpad')?.click();
    }
  }

  // Reactive collection from the shared model (live only; null in standalone /
  // imperative mode). Recomputes when entries change (live reload) or the
  // settings tick bumps (cross-tab settings change). Kept as a $derived so the
  // sync $effect below depends only on this value, not on the artifact $state it
  // writes (which would self-trigger).
  const collected = $derived.by(() => {
    if (!model) return null;
    settingsTick; // eslint-disable-line no-unused-expressions -- dependency
    const all = collectArtifacts(model.entries);
    const settings = readArtifactSettings(window.localStorage);
    const { visible, hiddenCount: hidden } = filterArtifacts(all, settings);
    return { visible, hiddenCount: hidden, enabled: settings.enabled };
  });

  // Push the derived collection into the panel's display $state + tab chrome.
  // Reading/writing artifacts/selectedId via setArtifacts is untracked so the
  // effect's only dependency is `collected`.
  $effect(() => {
    const c = collected;
    if (!c) return;
    untrack(() => setArtifacts(c.visible, { hiddenCount: c.hiddenCount }));
    applyArtifactsEnabled(c.enabled);
    const countEl = document.getElementById('artifact-tab-count');
    if (countEl) {
      countEl.textContent = String(c.visible.length);
      countEl.hidden = c.visible.length === 0;
    }
  });

  onMount(() => {
    if (!highlight) {
      import('highlight.js').then(({ default: loaded }) => { loadedHljs = loaded; }).catch(() => {});
    }
    // Reflect artifact-setting changes made on the /settings page (in another
    // tab) without a reload. The `storage` event fires only in other documents,
    // so this won't double-fire for changes originating in this same tab. A null
    // key means storage was cleared — re-read defaults.
    const onStorage = (e) => {
      if (e.key === null || ARTIFACT_SETTING_KEYS.includes(e.key)) settingsTick += 1;
    };
    if (model) window.addEventListener('storage', onStorage);
    sessionRuntime.artifacts = {
      setArtifacts,
      selectArtifact,
      render: () => {},
      getSelectedId: () => selectedId,
      getArtifact: (id) => artifacts.find((a) => a.id === id) || null,
      getCount: () => artifacts.length,
    };
    return () => {
      if (model) window.removeEventListener('storage', onStorage);
      sessionRuntime.artifacts = null;
    };
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
