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
  import LoadEarlier from './LoadEarlier.svelte';
  import SessionTree from './SessionTree.svelte';
  import ShareDialog from './ShareDialog.svelte';
  import { sessionModals } from '../../session/session-modals.svelte.js';
  import { getSessionRuntime } from '../../session/session-runtime-context.js';

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
      <div id="messages"><SessionContent model={sessionModel} afterRender={contentRuntime.afterRender} live /></div>
    </main>
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
<svelte:element this={'script'} id="session-data" type="application/json" bind:this={dataEl}></svelte:element>
