<script>
  // Shows who owns the open session on a multi-user hub ("de Bruno") so people
  // working together on a colleague's session always see whose it is.
  import { icon, User, Users } from '../../shared/icons.js';
  import { fetchSessionOwner, displayName } from '../../shared/people.js';

  let { sessionId = '', load = fetchSessionOwner } = $props();
  let info = $state(null);

  $effect(() => {
    const id = sessionId;
    info = null;
    if (!id) return;
    let cancelled = false;
    load(id)
      .then((d) => {
        if (!cancelled) info = d;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  });

  const label = $derived.by(() => {
    if (!info?.multiUser) return '';
    if (!info.owner) return 'sem dono';
    if (info.mine) return 'sua';
    return 'de ' + displayName({ login: info.owner, short: info.short });
  });
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG -->
{#if label}
  <span
    class="session-owner-badge"
    class:others={info && !info.mine}
    title={info?.owner
      ? `Dono: ${info.owner}${info.source ? ' · importada de ' + info.source : ''}`
      : 'Sessão sem dono'}
    >{@html icon(info && !info.mine ? Users : User, { size: 12 })}<span>{label}</span
    >{#if info?.source}<span class="session-owner-source">{info.source}</span>{/if}</span
  >
{/if}
