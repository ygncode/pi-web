<script>
  import { onMount, tick } from 'svelte';
  import SessionShell from '../components/session/SessionShell.svelte';
  import { applyLazyHighlighting } from '../session/lazy-highlight.js';
  import { loadSessionPageState } from './session-page-data.js';
  import { SessionDataModel } from '../session/data/session-data.svelte.js';
  import { hydrateSessionModel, createLiveSessionRuntime } from '../session/page/session-page-model.js';
  import { applySessionPageBodyClasses, applyStoredSessionLayout } from '../session/page/session-page-layout.js';
  import { startSessionPageRuntime } from '../session/page/session-page-runtime.js';
  import { setSessionModel } from '../session/session-context.js';
  import { resetSessionModals } from '../session/session-modals.svelte.js';
  import { resetSessionRuntime } from '../session/session-runtime.js';
  import { resetSessionRuntimeContext } from '../session/session-runtime-context.js';
  import { t } from '../shared/i18n.js';

  // The reactive session model (docs/dev/svelte-migration-plan.md): created once
  // and provided via context so descendant components read from it. Hydrated
  // from the session payload below; the live runtime (startSessionPageRuntime in
  // onMount) mutates it on reload.
  const sessionModel = setSessionModel(new SessionDataModel());

  // Post-render hook for the message pane: <SessionContent> renders
  // model.activePath as <SessionEntry> components and runs afterRender after each
  // render. wireSessionContentRuntime() (in onMount) assigns it (toggle state +
  // lazy highlight); the $state proxy makes the hook apply reactively.
  const contentRuntime = $state({ afterRender: null });

  let loading = $state(true);
  let showLoading = $state(false);
  let error = $state('');
  let sessionId = $state('');
  let title = $state('Session');
  let payloadBase64 = $state('');
  let scratchpad = $state('');
  let cwd = $state('');
  let chatAvailable = $state(true);
  let chatDisabledReason = $state('');
  let modelLabel = $state('');
  let dataEl = $state(null);

  onMount(() => {
    const previousTitle = document.title;
    let active = true;
    let disposeRuntime = null;
    const disposeBodyClasses = applySessionPageBodyClasses({ documentImpl: document });
    applyStoredSessionLayout({ documentImpl: document, windowImpl: window, storage: window.localStorage });

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
        cwd = state.cwd;
        scratchpad = state.scratchpad;
        payloadBase64 = state.payloadBase64;
        chatAvailable = state.chatAvailable;
        chatDisabledReason = state.chatDisabledReason;
        modelLabel = state.modelLabel;
        hydrateSessionModel({ sessionModel, payloadBase64, locationSearch: window.location.search, windowImpl: window });
        createLiveSessionRuntime({ sessionModel, contentRuntime, windowImpl: window, documentImpl: document });
        loading = false;
        clearTimeout(loadingTimer);
        await tick();
        if (!active) return;
        // Svelte does not interpolate mustache tags inside a <script> raw-text
        // element, so the embedded session payload must be assigned directly.
        if (dataEl) dataEl.textContent = payloadBase64;
        disposeRuntime = startSessionPageRuntime({
          sessionId,
          applyLazyHighlighting,
          windowImpl: window,
          documentImpl: document,
        });
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
      disposeRuntime?.();
      resetSessionModals();
      resetSessionRuntime();
      resetSessionRuntimeContext({ windowImpl: window });
      document.title = previousTitle;
      disposeBodyClasses();
    };
  });
</script>

{#if loading}
  {#if showLoading}<div class="session-loading">{t('session.loading')}</div>{/if}
{:else if error}
  <div class="session-loading"><h1>{error}</h1><p><a href="/">{t('session.backToSessions')}</a></p></div>
{:else}
  <SessionShell
    {sessionModel}
    {contentRuntime}
    {sessionId}
    {title}
    {scratchpad}
    {cwd}
    {chatAvailable}
    {chatDisabledReason}
    {modelLabel}
    bind:dataEl
  />
{/if}
