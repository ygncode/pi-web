<script>
  import { onMount, tick } from 'svelte';
  import ChatComposer from '../components/session/ChatComposer.svelte';
  import CommandMenu from '../components/session/CommandMenu.svelte';
  import RightSidebar from '../components/session/RightSidebar.svelte';
  import SessionHeader from '../components/session/SessionHeader.svelte';
  import SessionInfoHeader from '../components/session/SessionInfoHeader.svelte';
  import SessionTree from '../components/session/SessionTree.svelte';
  import ShareDialog from '../components/session/ShareDialog.svelte';
  import { applyLazyHighlighting, runSessionApp } from '../session/session.js';
  import { firstMessageStub, loadSessionPageState } from './session-page-data.js';
  import { SessionDataModel } from '../session/data/session-data.svelte.js';
  import { createSessionDataModel, decodeBase64JSON } from '../session/data/session-data.js';
  import { setSessionModel } from '../session/session-context.js';
  import { t } from '../shared/i18n.js';

  // Phase 1 of the Svelte migration (docs/dev/svelte-migration-plan.md):
  // create the reactive model once and provide it via context so descendant
  // components can begin reading from it in later phases. It is hydrated when
  // the session payload loads below. The legacy runSessionApp() render path is
  // still in charge of the DOM for now — this model is not yet consumed.
  const sessionModel = setSessionModel(new SessionDataModel());

  let loading = $state(true);
  let showLoading = $state(false);
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
    // The session view is a fixed app shell (no body scroll, internal scroll
    // containers). Mark the document so the session-only layout rules in the
    // shared SPA stylesheet do not pin body height on the index/settings pages.
    document.documentElement.classList.add('pi-session-page');
    document.body.classList.add('pi-session-page');

    // Avoid flashing the loading text on fast (localhost) loads: only reveal the
    // indicator if the fetch is still pending after a short delay.
    const loadingTimer = setTimeout(() => {
      if (active && loading) showLoading = true;
    }, 200);

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
        // Hydrate the shared reactive model from the SAME payload the imperative
        // runtime reads, then hand it to that runtime (window.__piSessionDataModel)
        // so session.js reuses this one instance instead of building its own.
        // The Svelte tree renders from it; session.js mutates it on live reload.
        sessionModel.load(createSessionDataModel(
          decodeBase64JSON(payloadBase64, { atobImpl: window.atob?.bind(window) }),
          new URLSearchParams(window.location.search),
        ));
        window.__piSessionDataModel = sessionModel;
        loading = false;
        clearTimeout(loadingTimer);
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
        clearTimeout(loadingTimer);
      }
    })();

    return () => {
      active = false;
      clearTimeout(loadingTimer);
      document.title = previousTitle;
      document.documentElement.classList.remove('pi-session-page');
      document.body.classList.remove('pi-session-page');
    };
  });
</script>

{#if loading}
  {#if showLoading}<div class="session-loading">{t('session.loading')}</div>{/if}
{:else if error}
  <div class="session-loading"><h1>{error}</h1><p><a href="/">{t('session.backToSessions')}</a></p></div>
{:else}
  <script>try{const c=localStorage.getItem('pi-share:v1:sidebar-collapsed');if(c==='true')document.body.classList.add('sidebar-collapsed');}catch(e){}try{const lw=Number(localStorage.getItem('pi-share:v1:sidebar-width'));if(isFinite(lw)&&lw>0)document.documentElement.style.setProperty('--sidebar-width',Math.round(lw)+'px');}catch(e){}try{const rc=localStorage.getItem('pi-web:v1:right-sidebar-collapsed');const mobile=window.matchMedia&&window.matchMedia('(max-width: 900px)').matches;if(rc==='true'||mobile)document.body.classList.add('right-sidebar-collapsed');}catch(e){}try{const w=Number(localStorage.getItem('pi-web:v1:right-sidebar-width'));if(isFinite(w)&&w>0)document.documentElement.style.setProperty('--right-sidebar-width',Math.round(w)+'px');}catch(e){}</script>

  <SessionHeader {title} />

  <CommandMenu />

  <div id="sidebar-overlay"></div>
  <div id="app">
    <SessionTree />
    <div id="content-container" class="content-container">
      <main id="content"><div id="header-container">{#if sessionModel}<SessionInfoHeader model={sessionModel} />{/if}</div><div id="messages">{@html firstMessageStub(entries)}</div></main>
      <ChatComposer {sessionId} {chatAvailable} {chatDisabledReason} {cwd} {modelLabel} />
    </div>
    <RightSidebar {scratchpad} />
    <div id="image-modal" class="image-modal"><img id="modal-image" src="" alt=""></div>
  </div>

  <ShareDialog />
  <script id="session-data" type="application/json" bind:this={dataEl}></script>
{/if}
