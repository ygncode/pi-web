<script>
  import { onMount } from 'svelte';
  import CommandPalette from '../components/shared/CommandPalette.svelte';
  import HomeMenu from '../components/index/HomeMenu.svelte';
  import IndexHeader from '../components/index/IndexHeader.svelte';
  import NewSessionModal from '../components/index/NewSessionModal.svelte';
  import ProjectsModal from '../components/index/ProjectsModal.svelte';
  import { runIndexPage } from '../index/index.js';

  onMount(() => {
    const previousTitle = document.title;
    document.title = 'Pi Sessions';
    runIndexPage({ documentImpl: document, windowImpl: window, refreshOnStart: true });
    return () => {
      document.title = previousTitle;
    };
  });
</script>

<IndexHeader />

<HomeMenu />

<button class="new-session-btn new-session-btn-mobile" id="newSessionBtn" type="button" data-new-session-btn aria-label="Start a new session" title="Start new session">+</button>

<CommandPalette />

<div class="content" data-sessions-content>
  <div class="empty-state">
    <h3>Loading sessions…</h3>
    <p>Fetching the latest session list.</p>
  </div>
</div>

<NewSessionModal />

<ProjectsModal />
