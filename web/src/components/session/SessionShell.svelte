<script>
  import ChatComposer from './ChatComposer.svelte';
  import LiveReload from './LiveReload.svelte';
  import CommandMenu from './CommandMenu.svelte';
  import RightSidebar from './RightSidebar.svelte';
  import SessionHeader from './SessionHeader.svelte';
  import SessionInfoHeader from './SessionInfoHeader.svelte';
  import SessionContent from './SessionContent.svelte';
  import ImageModal from './ImageModal.svelte';
  import ShortcutsModal from './ShortcutsModal.svelte';
  import ModelUsageModal from './ModelUsageModal.svelte';
  import ForkModal from './ForkModal.svelte';
  import CatGatekeeperSettings from './CatGatekeeperSettings.svelte';
  import CatGatekeeper from './CatGatekeeper.svelte';
  import BtwPopup from './BtwPopup.svelte';
  import LabelModal from './LabelModal.svelte';
  import DiffModal from './DiffModal.svelte';
  import LoadEarlier from './LoadEarlier.svelte';
  import SessionTree from './SessionTree.svelte';
  import ShareDialog from './ShareDialog.svelte';
  import { sessionModals } from '../../session/session-modals.svelte.js';
  import { getSessionRuntime } from '../../session/session-runtime-context.js';
  import { onMount } from 'svelte';
  import { createAnnotationApi } from '../../session/annotations/annotation-api.js';
  import { sessionRuntime } from '../../session/session-runtime.js';

  let {
    sessionModel,
    contentRuntime,
    sessionId = '',
    title = 'Session',
    scratchpad = '',
    cwd = '',
    chatAvailable = true,
    chatDisabledReason = '',
    modelLabel = '',
    dataEl = $bindable(null),
  } = $props();

  const runtime = getSessionRuntime();

  // Annotation config, supplied as props to <AnnotationLayer> (via <RightSidebar>)
  // instead of the former imperative init() up-call. The DOM anchors are resolved
  // after mount; the callbacks route through the shared session runtime.
  let annotationScopes = $state([]);
  let annotationComposer = $state(null);
  let annotationCountEl = $state(null);

  const annotationApi = $derived(
    sessionId ? createAnnotationApi({ sessionId, fetchImpl: window.fetch.bind(window) }) : null,
  );

  const annotationConfig = $derived({
    api: annotationApi,
    scopes: annotationScopes,
    composerEl: annotationComposer,
    countEl: annotationCountEl,
    onSelectArtifact: (artifactId) => {
      sessionRuntime.rightSidebar?.activateTab('artifacts');
      sessionRuntime.artifacts?.selectArtifact(artifactId);
    },
    onCreate: () => {
      sessionRuntime.rightSidebar?.open();
      sessionRuntime.rightSidebar?.activateTab('notes');
    },
    onSend: () => {
      if (sessionRuntime.layout?.isMobileLayout?.()) sessionRuntime.rightSidebar?.collapse();
    },
    onAddToChat: (attachment) => {
      window.dispatchEvent(new CustomEvent('pi-chat-attach-text', { detail: attachment }));
      if (sessionRuntime.layout?.isMobileLayout?.()) sessionRuntime.rightSidebar?.collapse();
    },
    resolveArtifact: (artifactId) => sessionRuntime.artifacts?.getArtifact(artifactId) || null,
  });

  onMount(() => {
    annotationScopes = [
      document.getElementById('messages'),
      document.getElementById('artifact-panel-host'),
    ].filter(Boolean);
    annotationComposer = document.getElementById('pi-chat-message');
    annotationCountEl = document.getElementById('annotation-tab-count');

    const onReload = () => sessionRuntime.annotations?.reapply();
    window.addEventListener('pi-session-reload', onReload);
    return () => window.removeEventListener('pi-session-reload', onReload);
  });
</script>

<SessionHeader {title} {cwd} {sessionId} />

<CommandMenu {sessionId} />

<!-- Live reload (SSE) mounts before <ChatComposer> so its optimistic
     "message sent" listener is attached before the user can send. -->
<LiveReload />

<div id="sidebar-overlay"></div>
<div id="app">
  <SessionTree />
  <div id="content-container" class="content-container">
    <main id="content">
      <div id="header-container"><SessionInfoHeader model={sessionModel} /></div>
      <LoadEarlier model={sessionModel} {sessionId} navigateTo={runtime.navigateTo} />
      <div id="messages">
        <SessionContent model={sessionModel} afterRender={contentRuntime.afterRender} live />
      </div>
    </main>
    <ChatComposer {sessionId} {chatAvailable} {chatDisabledReason} {cwd} {modelLabel} />
  </div>
  <RightSidebar {scratchpad} projectPath={cwd} {annotationConfig} />
  <ImageModal />
</div>

<ShortcutsModal bind:open={sessionModals.shortcuts} />
<ModelUsageModal bind:open={sessionModals.modelUsage} />
<ForkModal
  bind:open={sessionModals.fork.open}
  entries={sessionModals.fork.entries}
  onSelect={sessionModals.fork.onSelect}
/>
<CatGatekeeperSettings
  bind:open={sessionModals.catSettings.open}
  controller={sessionModals.catSettings.controller}
  onChange={sessionModals.catSettings.onChange}
/>
<LabelModal
  bind:open={sessionModals.label.open}
  entryId={sessionModals.label.entryId}
  currentLabel={sessionModals.label.currentLabel}
  onSave={sessionModals.label.onSave}
/>
<DiffModal bind:open={sessionModals.diff.open} sessionId={sessionModals.diff.sessionId} />

<ShareDialog {sessionId} />
<CatGatekeeper />
<BtwPopup {cwd} parentId={sessionId} />
<svelte:element this={"script"} id="session-data" type="application/json" bind:this={dataEl}
></svelte:element>
