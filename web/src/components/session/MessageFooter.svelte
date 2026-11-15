<script>
  // Codex-style footer under a finished assistant message: copy the final
  // markdown, rate it (👍/👎, stored for LoRA curation), copy a permalink, the
  // finish time, and the files the turn created/changed.
  import {
    icon,
    Copy,
    Check,
    ThumbsUp,
    ThumbsDown,
    Link2,
    FileCode,
    ChevronRight,
    RotateCcw,
  } from '../../shared/icons.js';
  import { copyToClipboard } from '../../shared/clipboard.js';
  import {
    finalText,
    shortTime,
    turnFiles,
    permalink,
    currentSessionId,
    loadRatings,
    saveRating,
    retrySource,
    retryMessage,
  } from '../../session/ui/message-footer.js';

  let {
    entry,
    model = null,
    live = false,
    copy = copyToClipboard,
    rate = saveRating,
    ratings = loadRatings,
    retry = retryMessage,
  } = $props();

  const msg = $derived(entry?.message);
  const text = $derived(finalText(msg));
  const time = $derived(shortTime(entry?.timestamp));
  const changes = $derived(text ? turnFiles(entry, model?.entries) : { files: [] });

  const retrySrc = $derived(live && text ? retrySource(entry, model?.entries) : null);
  let retrying = $state(false);

  let copied = $state('');
  let rating = $state(0);
  let filesOpen = $state(null);
  const showFiles = $derived(filesOpen ?? changes.files.length <= 3);

  $effect(() => {
    const sid = currentSessionId();
    const id = entry?.id;
    if (!live || !sid || !id || !text) return;
    ratings(sid).then((r) => {
      rating = Number(r?.[id] || 0);
    });
  });

  function flash(kind) {
    copied = kind;
    setTimeout(() => {
      if (copied === kind) copied = '';
    }, 1500);
  }

  async function onCopy() {
    if (await copy(text)) flash('text');
  }

  async function onLink() {
    const url = permalink(entry.id);
    if (url && (await copy(url))) flash('link');
  }

  async function onRate(v) {
    const next = rating === v ? 0 : v;
    const prev = rating;
    rating = next;
    try {
      await rate(currentSessionId(), entry.id, next);
    } catch {
      rating = prev;
    }
  }

  async function onRetry() {
    if (retrying || !retrySrc) return;
    retrying = true;
    try {
      await retry(currentSessionId(), retrySrc);
    } catch {
      retrying = false;
    }
  }

  function openFile(f) {
    const el = f.anchor && document.getElementById(f.anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.querySelector('.zc-row-head[aria-expanded="false"]')?.click();
  }
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG -->
{#if text}
  {#if changes.files.length}
    <div class="msg-files" class:open={showFiles}>
      <button
        type="button"
        class="msg-files-head"
        aria-expanded={showFiles}
        onclick={() => (filesOpen = !showFiles)}
      >
        <span class="msg-files-chev">{@html icon(ChevronRight, { size: 12 })}</span>
        <span
          >{changes.files.length}
          {changes.files.length === 1 ? 'arquivo alterado' : 'arquivos alterados'}</span
        >
        {#if changes.added}<span class="msg-add">+{changes.added}</span>{/if}
        {#if changes.removed}<span class="msg-del">−{changes.removed}</span>{/if}
      </button>
      {#if showFiles}
        <div class="msg-files-list">
          {#each changes.files as f (f.path)}
            <div class="msg-file-card" title={f.path}>
              <span class="msg-file-icon">{@html icon(FileCode, { size: 16 })}</span>
              <span class="msg-file-meta">
                <span class="msg-file-name">{f.name}</span>
                <span class="msg-file-type"
                  >{f.ext} · {f.op === 'write' ? 'criado' : 'editado'}{#if f.added}<span
                      class="msg-add"
                    >
                      +{f.added}</span
                    >{/if}{#if f.removed}<span class="msg-del"> −{f.removed}</span>{/if}</span
                >
              </span>
              {#if f.anchor}<button type="button" class="msg-file-open" onclick={() => openFile(f)}
                  >Abrir</button
                >{/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  <div class="msg-footer" role="toolbar" aria-label="Ações da mensagem">
    <button
      type="button"
      class="msg-act"
      title="Copiar resposta"
      aria-label="Copiar resposta"
      onclick={onCopy}
      >{@html icon(copied === 'text' ? Check : Copy, { size: 14 })}{#if copied === 'text'}<span
          class="msg-act-note">Copiado</span
        >{/if}</button
    >
    {#if live}
      <button
        type="button"
        class="msg-act"
        class:on={rating === 1}
        title="Boa resposta"
        aria-label="Boa resposta"
        aria-pressed={rating === 1}
        onclick={() => onRate(1)}>{@html icon(ThumbsUp, { size: 14 })}</button
      >
      <button
        type="button"
        class="msg-act"
        class:on={rating === -1}
        title="Resposta ruim"
        aria-label="Resposta ruim"
        aria-pressed={rating === -1}
        onclick={() => onRate(-1)}>{@html icon(ThumbsDown, { size: 14 })}</button
      >
    {/if}
    {#if retrySrc}
      <button
        type="button"
        class="msg-act"
        title="Refazer (novo ramo com o mesmo pedido)"
        aria-label="Refazer resposta"
        disabled={retrying}
        onclick={onRetry}>{@html icon(RotateCcw, { size: 14 })}</button
      >
    {/if}
    <button
      type="button"
      class="msg-act"
      title="Copiar link da mensagem"
      aria-label="Copiar link da mensagem"
      onclick={onLink}
      >{@html icon(copied === 'link' ? Check : Link2, { size: 14 })}{#if copied === 'link'}<span
          class="msg-act-note">Link copiado</span
        >{/if}</button
    >
    {#if time}<span class="msg-time" title={entry.timestamp}>{time}</span>{/if}
  </div>
{/if}
