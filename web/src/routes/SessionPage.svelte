<script>
  import { onMount, tick } from 'svelte';
  import ChatComposer from '../components/session/ChatComposer.svelte';
  import CommandMenu from '../components/session/CommandMenu.svelte';
  import RightSidebar from '../components/session/RightSidebar.svelte';
  import SessionHeader from '../components/session/SessionHeader.svelte';
  import SessionTree from '../components/session/SessionTree.svelte';
  import ShareDialog from '../components/session/ShareDialog.svelte';
  import { applyLazyHighlighting, runSessionApp } from '../session/session.js';
  import { firstMessageStub, loadSessionPageState } from './session-page-data.js';

  let loading = $state(true);
  let error = $state('');
  let sessionId = $state('');
  let title = $state('Session');
  let payloadBase64 = $state('');
  let entries = $state([]);
  let scratchpad = $state('');
  let cwd = $state('');
  let chatAvailable = $state(true);
  let chatDisabledReason = $state('');
  let modelLabel = $state('');
  let dataEl = $state(null);


  onMount(() => {
    const previousTitle = document.title;
    let active = true;

    (async () => {
      try {
        const state = await loadSessionPageState({ locationSearch: window.location.search, fetchImpl: window.fetch.bind(window) });
        if (!active) return;
        sessionId = state.sessionId;
        title = state.title;
        document.title = title;
        entries = state.entries;
        cwd = state.cwd;
        scratchpad = state.scratchpad;
        payloadBase64 = state.payloadBase64;
        chatAvailable = state.chatAvailable;
        chatDisabledReason = state.chatDisabledReason;
        modelLabel = state.modelLabel;
        loading = false;
        await tick();
        if (!active) return;
        // Svelte does not interpolate mustache tags inside a <script> raw-text
        // element, so the embedded session payload must be assigned directly.
        if (dataEl) dataEl.textContent = payloadBase64;
        runSessionApp({ target: window });
        applyLazyHighlighting(document);
      } catch (err) {
        if (!active) return;
        error = err?.message || 'Failed to load session';
        loading = false;
      }
    })();

    return () => {
      active = false;
      document.title = previousTitle;
    };
  });
</script>

{#if loading}
  <div class="session-loading">Loading session…</div>
{:else if error}
  <div class="session-loading"><h1>{error}</h1><p><a href="/">Back to sessions</a></p></div>
{:else}
  <script>try{const c=localStorage.getItem('pi-share:v1:sidebar-collapsed');if(c==='true')document.body.classList.add('sidebar-collapsed');}catch(e){}try{const lw=Number(localStorage.getItem('pi-share:v1:sidebar-width'));if(isFinite(lw)&&lw>0)document.documentElement.style.setProperty('--sidebar-width',Math.round(lw)+'px');}catch(e){}try{const rc=localStorage.getItem('pi-web:v1:right-sidebar-collapsed');const mobile=window.matchMedia&&window.matchMedia('(max-width: 900px)').matches;if(rc==='true'||mobile)document.body.classList.add('right-sidebar-collapsed');}catch(e){}try{const w=Number(localStorage.getItem('pi-web:v1:right-sidebar-width'));if(isFinite(w)&&w>0)document.documentElement.style.setProperty('--right-sidebar-width',Math.round(w)+'px');}catch(e){}</script>

  <SessionHeader {title} />

  <CommandMenu />

  <div id="sidebar-overlay"></div>
  <div id="app">
    <SessionTree />
    <div id="content-container" class="content-container">
      <main id="content"><div id="header-container"></div><div id="messages">{@html firstMessageStub(entries)}</div></main>
      <ChatComposer {sessionId} {chatAvailable} {chatDisabledReason} {cwd} {modelLabel} />
    </div>
    <RightSidebar {scratchpad} />
    <div id="image-modal" class="image-modal"><img id="modal-image" src="" alt=""></div>
  </div>

  <ShareDialog />
  <script id="session-data" type="application/json" bind:this={dataEl}></script>
{/if}
