<script>
  // Grid of zcode colour presets with live mini previews. Each swatch carries
  // its own data-zcode-preset attribute, so the preset CSS variables from
  // /custom-themes.css apply to the swatch itself — no colours are duplicated
  // in JS. `inline` renders the grid in place (Settings); otherwise it is a
  // sheet/modal opened via the pi:open-theme-picker window event.
  import { onMount } from 'svelte';
  import { icon, X, Check } from '../../shared/icons.js';
  import {
    listPresets,
    currentPreset,
    applyPreset,
    bootPreset,
    listActSchemes,
    currentActScheme,
    applyActScheme,
    OPEN_PICKER_EVENT,
  } from '../../shared/zcode-preset.js';
  import {
    currentScale,
    stepUiScale,
    applyUiScale,
    UI_SCALE_EVENT,
  } from '../../shared/ui-scale.js';

  let { inline = false } = $props();
  let open = $state(false);
  let presets = $state([]);
  let active = $state('');
  let filter = $state('all');
  let schemes = $state([]);
  let activeAct = $state('');
  let scale = $state(100);
  const DOTS = ['thinking', 'bash', 'read', 'edit', 'write', 'grep', 'web', 'task', 'todo'];

  const shown = $derived(filter === 'all' ? presets : presets.filter((p) => p.mode === filter));

  function refresh() {
    presets = listPresets();
    active = currentPreset();
    schemes = listActSchemes();
    activeAct = currentActScheme();
    scale = currentScale();
  }
  function chooseAct(id) {
    applyActScheme(id);
    activeAct = id;
  }
  function choose(id) {
    applyPreset(id);
    active = id;
  }

  onMount(() => {
    if (!inline) bootPreset();
    refresh();
    const onOpen = () => {
      refresh();
      open = true;
    };
    const onChange = () => {
      active = currentPreset();
      activeAct = currentActScheme();
      scale = currentScale();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') open = false;
    };
    if (!inline) window.addEventListener(OPEN_PICKER_EVENT, onOpen);
    window.addEventListener('pi:zcode-preset-change', onChange);
    window.addEventListener('pi:zcode-act-change', onChange);
    window.addEventListener(UI_SCALE_EVENT, onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(OPEN_PICKER_EVENT, onOpen);
      window.removeEventListener('pi:zcode-preset-change', onChange);
      window.removeEventListener('pi:zcode-act-change', onChange);
      window.removeEventListener(UI_SCALE_EVENT, onChange);
      window.removeEventListener('keydown', onKey);
    };
  });
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG -->

{#snippet actChip(id, label, attrs)}
  <button
    type="button"
    class="zc-act-chip"
    class:active={activeAct === id}
    aria-pressed={activeAct === id}
    title={label}
    onclick={() => chooseAct(id)}
    {...attrs}
  >
    <span class="zc-act-name"
      >{#if activeAct === id}<span class="zc-swatch-check">{@html icon(Check, { size: 13 })}</span
        >{/if}{label}</span
    >
    <span class="zc-act-dots" aria-hidden="true"
      >{#each DOTS as d (d)}<i style="background:var(--act-{d})"></i>{/each}</span
    >
    <span class="zc-act-sample" aria-hidden="true"><b>Negrito</b> · <span>Título</span></span>
  </button>
{/snippet}

{#snippet sizeControl()}
  <div class="zc-picker-section">Tamanho do texto e da interface</div>
  <div class="zc-size-row" role="group" aria-label="Tamanho da interface">
    <button
      type="button"
      class="zc-size-btn"
      aria-label="Diminuir"
      disabled={scale <= 80}
      onclick={() => (scale = stepUiScale(-1))}><span style="font-size:12px">A</span>−</button
    >
    <span class="zc-size-val" aria-live="polite">{scale}%</span>
    <button
      type="button"
      class="zc-size-btn"
      aria-label="Aumentar"
      disabled={scale >= 150}
      onclick={() => (scale = stepUiScale(1))}><span style="font-size:16px">A</span>+</button
    >
    <button
      type="button"
      class="zc-size-reset"
      class:active={scale === 100}
      onclick={() => (scale = applyUiScale(100))}>Padrão</button
    >
  </div>
  <div class="zc-size-steps" aria-hidden="true">
    {#each [80, 90, 100, 110, 120, 130, 140, 150] as st (st)}<button
        type="button"
        tabindex="-1"
        class:active={scale === st}
        onclick={() => (scale = applyUiScale(st))}>{st}</button
      >{/each}
  </div>
  <span class="zc-picker-hint"
    >Atalhos no Mac: ⌘⌥= / ⌘⌥− / ⌘⌥0 (Ctrl+Alt no Windows/Linux). Pinça também funciona.</span
  >
  <div class="zc-picker-sep"></div>
{/snippet}

{#snippet grid()}
  {@render sizeControl()}
  {#if schemes.length > 0}
    <div class="zc-picker-section">Cores das ações e do texto</div>
    <div class="zc-act-grid">
      {@render actChip('', 'Do tema', active ? { 'data-zcode-preset': active } : {})}
      {#each schemes as sc (sc.id)}{@render actChip(sc.id, sc.label, {
          'data-zcode-act': sc.id,
        })}{/each}
    </div>
    <div class="zc-picker-sep"></div>
    <div class="zc-picker-section">Tema (fundo)</div>
  {/if}
  <div class="zc-picker-filters" role="tablist">
    {#each [['all', 'Todos'], ['dark', 'Escuros'], ['light', 'Claros']] as [key, label] (key)}
      <button
        type="button"
        class="zc-picker-filter"
        class:active={filter === key}
        onclick={() => (filter = key)}>{label}</button
      >
    {/each}
  </div>
  {#if presets.length === 0}
    <p class="zc-picker-empty">
      Nenhum preset encontrado. Rode <code>zcode-theme</code> no Mac para gerar /custom-themes.css.
    </p>
  {/if}
  <div class="zc-picker-grid">
    {#each shown as p (p.id)}
      <button
        type="button"
        class="zc-swatch"
        class:active={active === p.id}
        data-zcode-preset={p.id}
        aria-pressed={active === p.id}
        title={p.label}
        onclick={() => choose(p.id)}
      >
        <span class="zc-swatch-preview" aria-hidden="true">
          <span class="zc-swatch-bubble"></span>
          <span class="zc-swatch-line zc-l1"></span>
          <span class="zc-swatch-line zc-l2"></span>
          <span class="zc-swatch-dots"
            ><i style="background:var(--act-thinking)"></i><i style="background:var(--act-bash)"
            ></i><i style="background:var(--act-read)"></i><i style="background:var(--act-edit)"
            ></i><i style="background:var(--act-write)"></i><i style="background:var(--act-grep)"
            ></i><i style="background:var(--act-web)"></i><i style="background:var(--act-task)"
            ></i></span
          >
        </span>
        <span class="zc-swatch-name"
          >{#if active === p.id}<span class="zc-swatch-check"
              >{@html icon(Check, { size: 13 })}</span
            >{/if}{p.label}</span
        >
      </button>
    {/each}
  </div>
  <div class="zc-picker-footer">
    <button type="button" class="zc-picker-reset" class:active={!active} onclick={() => choose('')}
      >Usar tema padrão do pi-web</button
    >
    <span class="zc-picker-hint">Muda na hora e sincroniza entre Mac e iPhone.</span>
  </div>
{/snippet}

{#if inline}
  <div class="zc-picker zc-picker-inline">{@render grid()}</div>
{:else if open}
  <div class="zc-picker-backdrop" role="presentation" onclick={() => (open = false)}></div>
  <div class="zc-picker zc-picker-sheet" role="dialog" aria-modal="true" aria-label="Aparência">
    <div class="zc-picker-head">
      <span class="zc-picker-title">Aparência</span>
      <button
        type="button"
        class="zc-picker-close"
        aria-label="Fechar"
        onclick={() => (open = false)}>{@html icon(X, { size: 16 })}</button
      >
    </div>
    <div class="zc-picker-body">{@render grid()}</div>
  </div>
{/if}
