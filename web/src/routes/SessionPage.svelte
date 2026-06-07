<script>
  import { onMount, tick } from 'svelte';
  import ChatComposer from '../components/session/ChatComposer.svelte';
  import LiveReload from '../components/session/LiveReload.svelte';
  import CommandMenu from '../components/session/CommandMenu.svelte';
  import RightSidebar from '../components/session/RightSidebar.svelte';
  import SessionHeader from '../components/session/SessionHeader.svelte';
  import SessionInfoHeader from '../components/session/SessionInfoHeader.svelte';
  import SessionContent from '../components/session/SessionContent.svelte';
  import ImageModal from '../components/session/ImageModal.svelte';
  import ShortcutsModal from '../components/session/ShortcutsModal.svelte';
  import ModelUsageModal from '../components/session/ModelUsageModal.svelte';
  import ForkModal from '../components/session/ForkModal.svelte';
  import CatGatekeeperSettings from '../components/session/CatGatekeeperSettings.svelte';
  import CatGatekeeper from '../components/session/CatGatekeeper.svelte';
  import BtwPopup from '../components/session/BtwPopup.svelte';
  import LabelModal from '../components/session/LabelModal.svelte';
  import LoadEarlier from '../components/session/LoadEarlier.svelte';
  import SessionTree from '../components/session/SessionTree.svelte';
  import ShareDialog from '../components/session/ShareDialog.svelte';
  import { marked } from 'marked';
  import { applyLazyHighlighting } from '../session/lazy-highlight.js';
  import { wireSessionContentRuntime } from '../session/session-content-runtime.js';
  import { setupSessionGlobals } from '../session/session-globals.js';
  import { setupSessionUi } from '../session/ui/session-ui-runner.js';
  import { createAnnotationApi } from '../session/annotations/annotation-api.js';
  import { configureSessionMarkdown, safeMarkedParse } from '../session/render/markdown.js';
  import * as sidebarApi from '../session/ui/sidebar.js';
  import * as searchFiltersApi from '../session/ui/search-filters.js';
  import * as toggleStateApi from '../session/ui/toggle-state.js';
  import { loadSessionPageState } from './session-page-data.js';
  import { SessionDataModel } from '../session/data/session-data.svelte.js';
  import { createSessionDataModel, decodeBase64JSON } from '../session/data/session-data.js';
  import { createSessionNavigator } from '../session/navigation/session-navigation.js';
  import { setSessionModel } from '../session/session-context.js';
  import { sessionModals, resetSessionModals } from '../session/session-modals.svelte.js';
  import { sessionRuntime, resetSessionRuntime } from '../session/session-runtime.js';
  import { configureSettingsSync, hydrateSettings } from '../shared/settings-store.js';
  import { t } from '../shared/i18n.js';

  // The reactive session model (docs/dev/svelte-migration-plan.md): created once
  // and provided via context so descendant components read from it. Hydrated
  // from the session payload below; the live runtime (startSessionRuntime in
  // onMount) mutates it on reload.
  const sessionModel = setSessionModel(new SessionDataModel());

  // Post-render hook for the message pane: <SessionContent> renders
  // model.activePath as <SessionEntry> components and runs afterRender after each
  // render. wireSessionContentRuntime() (in onMount) assigns it (toggle state +
  // lazy highlight); the $state proxy makes the hook apply reactively.
  const contentRuntime = $state({ afterRender: null });

  // Modal/sheet open-state lives in the shared sessionModals store so the
  // command menu, keyboard globals, content runtime, and cat-gatekeeper can open
  // them by importing the store helpers instead of via window bridges. The modal
  // components below bind directly to it.

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
    let disposeGlobals = null;
    let removeAnnotationReload = null;

    // Live session runtime — the imperative wiring that used to live in
    // session.js's runSessionApp (Svelte migration teardown). Runs once the
    // payload + reactive model are ready and the components have mounted.
    const startSessionRuntime = () => {
      const model = sessionModel;
      // Per-page settings + markdown bootstrap (mirrors index/settings pages).
      configureSettingsSync({ fetchImpl: window.fetch ? window.fetch.bind(window) : undefined });
      hydrateSettings({ storage: window.localStorage });
      window.marked = window.marked || marked;

      // Wire the live message pane: entry renderer + content runtime + the
      // delegated copy/fork/label handler on #messages.
      const { sessionFormat } = wireSessionContentRuntime({
        windowImpl: window,
        documentImpl: document,
        model,
        sessionId,
        contentRuntime,
        applyLazyHighlighting,
      });

      // Sidebar / search / tree-toggle / header runtime.
      const ui = setupSessionUi({
        documentImpl: document,
        windowImpl: window,
        storage: window.localStorage,
        marked,
        hljs: null,
        escapeHtml: sessionFormat.escapeHtml,
        markdownApi: { configureSessionMarkdown, safeMarkedParse },
        searchFiltersApi,
        sidebarApi,
        toggleStateApi,
        getLeafId: () => model.leafId,
        setSearchQuery: (value) => { model.searchQuery = value; },
        setFilterMode: (value) => { model.filterMode = value; },
        // The reactive model recomputes filteredNodes; no manual rerender needed.
        forceTreeRerender: () => {},
        navigateTo: (...args) => window.navigateTo(...args),
      });

      // Exposed for <SessionTree>'s node-click handler (auto-close mobile drawer).
      sessionRuntime.layout = { isMobileLayout: ui.isMobileLayout, closeSidebar: ui.closeSidebar };

      // The header card is a persistent <SessionInfoHeader>, so bind its toggle
      // buttons exactly once.
      ui.attachHeaderHandlers();

      // Replace the server-rendered first-message LCP stub with the canonical
      // active path before live reload starts (otherwise reload appends entries
      // below the stub and the conversation appears duplicated).
      window.navigateTo(model.currentLeafId, model.urlTargetId ? 'target' : 'bottom', model.urlTargetId || null);

      // Annotation layer (right-sidebar "Notes" tab) — <AnnotationLayer> registers
      // init/setAnnotations/reapply in sessionRuntime.annotations; supply its
      // runtime deps here. Anchors to entries by `entry-<id>` + offsets.
      const annotationLayer = sessionRuntime.annotations || null;
      const messagesEl = document.getElementById('messages');
      if (annotationLayer && messagesEl && sessionId) {
        const annotationArtifactHost = document.getElementById('artifact-panel-host');
        annotationLayer.init({
          api: createAnnotationApi({ sessionId, fetchImpl: window.fetch.bind(window) }),
          scopes: [messagesEl, annotationArtifactHost].filter(Boolean),
          composerEl: document.getElementById('pi-chat-message'),
          countEl: document.getElementById('annotation-tab-count'),
          onSelectArtifact: (artifactId) => {
            ui.activateRightTab('artifacts');
            sessionRuntime.artifacts?.selectArtifact(artifactId);
          },
          onCreate: () => {
            ui.openRightSidebar();
            ui.activateRightTab('notes');
          },
          onSend: () => {
            // On mobile the sidebar is a full-screen overlay; collapse it so the
            // composer it just filled is visible and ready to type into.
            if (ui.isMobileLayout()) ui.collapseRightSidebar();
          },
          onAddToChat: (attachment) => {
            window.dispatchEvent(new window.CustomEvent('pi-chat-attach-text', { detail: attachment }));
            if (ui.isMobileLayout()) ui.collapseRightSidebar();
          },
          resolveArtifact: (artifactId) => sessionRuntime.artifacts?.getArtifact(artifactId) || null,
        });
        const onAnnotationReload = () => annotationLayer.reapply();
        window.addEventListener('pi-session-reload', onAnnotationReload);
        removeAnnotationReload = () => window.removeEventListener('pi-session-reload', onAnnotationReload);
      }

      // Page-global glue (keyboard shortcuts, done-notifier,
      // visual-viewport/scroll). After the
      // above so the sidebar / right-sidebar window bridges exist.
      disposeGlobals = setupSessionGlobals({
        windowImpl: window,
        documentImpl: document,
        model,
        sessionId,
        navigateTo: window.navigateTo,
      });
    };

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
        cwd = state.cwd;
        scratchpad = state.scratchpad;
        payloadBase64 = state.payloadBase64;
        chatAvailable = state.chatAvailable;
        chatDisabledReason = state.chatDisabledReason;
        modelLabel = state.modelLabel;
        // Hydrate the shared reactive model from the embedded payload and expose
        // it on window so the live runtime + chat/live components share this one
        // instance. The Svelte tree/content render from it; live reload mutates it.
        sessionModel.load(createSessionDataModel(
          decodeBase64JSON(payloadBase64, { atobImpl: window.atob?.bind(window) }),
          new URLSearchParams(window.location.search),
        ));
        window.__piSessionDataModel = sessionModel;
        // navigateTo ownership lives here: the navigator writes the reactive
        // model's active leaf/target (→ <SessionContent>/<SessionTree> recompute)
        // and scrolls. Exposed on window BEFORE the child components mount so the
        // tree, chat composer, and live reload share this one instance.
        const navigator = createSessionNavigator({
          onNavigate: (leaf, target) => { sessionModel.currentLeafId = leaf; sessionModel.currentTargetId = target; },
        });
        window.navigateTo = navigator.navigateTo;
        window.__piSessionNavigator = navigator;
        // Model reconciliation for <LiveReload> (SSE) + the load-earlier banner.
        // Set before the child components mount so a reload can never race it.
        window.__piReconcileEntries = (entries) => sessionModel.reconcile(entries);
        window.__piContentRuntime = contentRuntime;
        loading = false;
        clearTimeout(loadingTimer);
        await tick();
        if (!active) return;
        // Svelte does not interpolate mustache tags inside a <script> raw-text
        // element, so the embedded session payload must be assigned directly.
        if (dataEl) dataEl.textContent = payloadBase64;
        startSessionRuntime();
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
      disposeGlobals?.();
      removeAnnotationReload?.();
      resetSessionModals();
      resetSessionRuntime();
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

  <SessionHeader {title} {cwd} {sessionId} />

  <CommandMenu {sessionId} />

  <!-- Live reload (SSE) mounts before <ChatComposer> so its optimistic
       "message sent" listener is attached before the user can send. -->
  <LiveReload />

  <div id="sidebar-overlay"></div>
  <div id="app">
    <SessionTree />
    <div id="content-container" class="content-container">
      <main id="content"><div id="header-container">{#if sessionModel}<SessionInfoHeader model={sessionModel} />{/if}</div>{#if sessionModel}<LoadEarlier model={sessionModel} {sessionId} navigateTo={typeof window !== 'undefined' ? window.navigateTo : null} />{/if}<div id="messages">{#if sessionModel}<SessionContent model={sessionModel} afterRender={contentRuntime.afterRender} live />{/if}</div></main>
      <ChatComposer {sessionId} {chatAvailable} {chatDisabledReason} {cwd} {modelLabel} />
    </div>
    <RightSidebar {scratchpad} projectPath={cwd} />
    <ImageModal />
  </div>

  <ShortcutsModal bind:open={sessionModals.shortcuts} />
  <ModelUsageModal bind:open={sessionModals.modelUsage} />
  <ForkModal bind:open={sessionModals.fork.open} entries={sessionModals.fork.entries} onSelect={sessionModals.fork.onSelect} />
  <CatGatekeeperSettings bind:open={sessionModals.catSettings.open} controller={sessionModals.catSettings.controller} onChange={sessionModals.catSettings.onChange} />
  <LabelModal bind:open={sessionModals.label.open} entryId={sessionModals.label.entryId} currentLabel={sessionModals.label.currentLabel} onSave={sessionModals.label.onSave} />

  <ShareDialog {sessionId} />
  <CatGatekeeper />
  <BtwPopup {cwd} parentId={sessionId} />
  <script id="session-data" type="application/json" bind:this={dataEl}></script>
{/if}
