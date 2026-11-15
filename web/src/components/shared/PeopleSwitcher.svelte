<script>
  // Multi-user hub: choose whose sessions the left sidebar lists. Defaults to
  // the caller's own; colleagues' sessions open normally and can be continued
  // together. Hidden entirely on single-user installs.
  import { onMount } from 'svelte';
  import { icon, Users, User, Check, ChevronDown } from '../../shared/icons.js';
  import {
    VIEW_ALL,
    VIEW_MINE,
    VIEW_UNASSIGNED,
    displayName,
    fetchPeople,
    isOthersView,
    setView,
    viewLabel,
  } from '../../shared/people.js';

  let { load = fetchPeople, reload = () => globalThis.location?.reload() } = $props();

  let data = $state(null);
  let open = $state(false);
  let rootEl = $state(null);

  const view = $derived(data?.view || VIEW_MINE);
  const others = $derived(isOthersView(view, data));

  onMount(() => {
    load()
      .then((d) => (data = d))
      .catch(() => (data = null));
    const onDoc = (e) => {
      if (open && rootEl && !rootEl.contains(e.target)) open = false;
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  });

  function choose(v) {
    open = false;
    if (v === view) return;
    setView(v);
    // Colleagues' sessions are easiest to browse by project; mine by recency.
    try {
      globalThis.localStorage?.setItem(
        'pi-web:v1:left-sidebar-tab',
        v === VIEW_MINE ? 'sessions' : 'projects',
      );
    } catch {}
    reload();
  }

  function isActive(v) {
    if (v === VIEW_MINE) return !others;
    return view === v;
  }
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG -->
{#if data?.multiUser}
  <div class="people-switcher" class:others bind:this={rootEl}>
    <button
      type="button"
      class="people-switcher-btn"
      aria-haspopup="listbox"
      aria-expanded={open}
      title="Ver conversas de outras pessoas"
      onclick={() => (open = !open)}
    >
      <span class="people-switcher-icon">{@html icon(others ? Users : User, { size: 13 })}</span>
      <span class="people-switcher-label">{viewLabel(view, data)}</span>
      <span class="people-switcher-chev">{@html icon(ChevronDown, { size: 12 })}</span>
    </button>
    {#if open}
      <div class="people-switcher-menu" role="listbox" aria-label="Pessoas">
        <div class="people-switcher-section">Você</div>
        <button
          type="button"
          role="option"
          aria-selected={isActive(VIEW_MINE)}
          onclick={() => choose(VIEW_MINE)}
        >
          <span class="people-name">Minhas conversas</span>
          <span class="people-count">{data.people.find((p) => p.me)?.sessions ?? 0}</span>
          {#if isActive(VIEW_MINE)}<span class="people-check"
              >{@html icon(Check, { size: 12 })}</span
            >{/if}
        </button>
        <div class="people-switcher-section">Pessoas</div>
        {#each data.people.filter((p) => !p.me && !p.archived) as person (person.login)}
          <button
            type="button"
            role="option"
            aria-selected={isActive(person.login)}
            onclick={() => choose(person.login)}
            title={person.login}
          >
            <span class="people-avatar">{displayName(person).charAt(0)}</span>
            <span class="people-name">{displayName(person)}</span>
            <span class="people-count">{person.sessions}</span>
            {#if isActive(person.login)}<span class="people-check"
                >{@html icon(Check, { size: 12 })}</span
              >{/if}
          </button>
        {:else}
          <div class="people-empty">Ninguém mais tem conversas aqui ainda</div>
        {/each}
        {#if data.people.some((p) => p.archived)}
          <div class="people-switcher-section">Arquivados</div>
          {#each data.people.filter((p) => p.archived) as person (person.login)}
            <button
              type="button"
              role="option"
              aria-selected={isActive(person.login)}
              onclick={() => choose(person.login)}
              title={person.login}
            >
              <span class="people-name">{person.name || person.short}</span>
              <span class="people-count">{person.sessions}</span>
              {#if isActive(person.login)}<span class="people-check"
                  >{@html icon(Check, { size: 12 })}</span
                >{/if}
            </button>
          {/each}
        {/if}
        <div class="people-switcher-sep"></div>
        <button
          type="button"
          role="option"
          aria-selected={isActive(VIEW_ALL)}
          onclick={() => choose(VIEW_ALL)}
        >
          <span class="people-name">Todas as pessoas</span>
          <span class="people-count">{data.total}</span>
          {#if isActive(VIEW_ALL)}<span class="people-check">{@html icon(Check, { size: 12 })}</span
            >{/if}
        </button>
        {#if data.unassigned}
          <button
            type="button"
            role="option"
            aria-selected={isActive(VIEW_UNASSIGNED)}
            onclick={() => choose(VIEW_UNASSIGNED)}
          >
            <span class="people-name">Sem dono</span>
            <span class="people-count">{data.unassigned}</span>
            {#if isActive(VIEW_UNASSIGNED)}<span class="people-check"
                >{@html icon(Check, { size: 12 })}</span
              >{/if}
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}
