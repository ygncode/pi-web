<script>
  import { onMount, tick } from 'svelte';
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

  <div style="display:none">
    <button id="theme-toggle" title="Toggle light/dark theme">Theme</button>
    <button id="notify-toggle" title="Notify when response is ready" aria-pressed="false">Notify</button>
    <button id="resume-btn" title="Copy pi --session command to clipboard">Terminal</button>
    <button id="new-btn" title="New Session">Session</button>
    <button id="share-btn" title="Share session as GitHub Gist">Share</button>
  </div>

  <div class="session-header-bar">
    <div class="session-header-left">
      <a href="/" class="session-header-back"><span>←</span> Sessions</a>
      <button id="tree-toggle" class="session-header-actions session-header-tree-toggle" title="Toggle session tree" aria-label="Toggle session tree" aria-pressed="true">☷</button>
    </div>
    <span class="session-header-title" id="session-header-title">{title}</span>
    <div class="session-header-right">
      <button id="new-session-header-btn" class="session-header-new" title="New Session (⌘T)" aria-label="Start a new session"><span aria-hidden="true">+</span><span class="session-header-new-label">New</span></button>
      <button id="shortcuts-help-btn" class="session-header-shortcuts-help" title="Show keyboard shortcuts (⌘/)">⌘/</button>
      <button id="toggle-right-sidebar-btn" class="session-header-actions" title="Toggle scratchpad (⌘⇧N)" aria-label="Toggle scratchpad">✎</button>
      <button id="command-menu-btn" class="session-header-actions" aria-label="Session actions" aria-haspopup="menu" aria-expanded="false" aria-controls="command-menu-popover">⋯</button>
    </div>
  </div>

  <div id="command-menu-popover" class="command-menu-popover" role="menu" aria-labelledby="command-menu-btn" style="display: none;">
    <div class="command-menu-body">
      <button class="command-menu-item" type="button" data-action="list-sessions">Search Sessions <kbd>⌘K</kbd></button>
      <button class="command-menu-item" type="button" data-action="rename">Rename</button>
      <button class="command-menu-item" type="button" data-action="share">Share</button>
      <button class="command-menu-item" type="button" data-action="fork">Fork</button>
      <button class="command-menu-item" type="button" data-action="clone">Clone</button>
      <button class="command-menu-item" type="button" data-action="terminal">Resume via Terminal</button>
      <button class="command-menu-item" type="button" data-action="tree">Tree <kbd>⌘B</kbd></button>
      <button class="command-menu-item" type="button" data-action="diff">Diff</button>
      <button class="command-menu-item" type="button" data-action="model-usage">Model Usage</button>
      <a class="command-menu-item" href="/settings" role="menuitem"><span>Settings</span><kbd>⌘,</kbd></a>
      <button class="command-menu-item" type="button" data-action="version" data-version-row role="menuitem"><span>Version</span><span class="version-status" id="command-menu-version-status" data-version-status>…</span></button>
    </div>
  </div>
  <div id="mobile-command-backdrop" class="mobile-command-backdrop" style="display: none;"></div>
  <div id="mobile-command-panel" class="mobile-command-panel" style="display: none;">
    <div class="mobile-command-body">
      <button class="mobile-command-item" type="button" data-action="list-sessions">Search Sessions</button>
      <button class="mobile-command-item" type="button" data-action="rename">Rename</button>
      <button class="mobile-command-item" type="button" data-action="share">Share</button>
      <button class="mobile-command-item" type="button" data-action="fork">Fork</button>
      <button class="mobile-command-item" type="button" data-action="clone">Clone</button>
      <button class="mobile-command-item" type="button" data-action="terminal">Resume via Terminal</button>
      <button class="mobile-command-item" type="button" data-action="tree">Tree</button>
      <button class="mobile-command-item" type="button" data-action="diff">Diff</button>
      <button class="mobile-command-item" type="button" data-action="model-usage">Model Usage</button>
      <a class="mobile-command-item" href="/settings" role="menuitem">Settings</a>
    </div>
  </div>

  <div class="command-palette-overlay" id="sessionPalette" aria-hidden="true">
    <div class="command-palette" role="dialog" aria-modal="true" aria-label="List sessions">
      <div class="palette-search-wrap"><input type="text" id="session-palette-search" placeholder="Search sessions..." autocomplete="off"><button class="palette-search-close" type="button" data-palette-close aria-label="Close search">×</button></div>
      <div class="palette-results" data-palette-results></div>
      <div class="palette-section-title">Actions</div>
      <button class="palette-action" type="button" data-new-session-btn>New session</button>
      <button class="palette-action muted" type="button" data-import-session-btn disabled>Import session</button>
    </div>
  </div>

  <div id="sidebar-overlay"></div>
  <div id="app">
    <aside id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-controls"><input type="text" class="sidebar-search" id="tree-search" placeholder="Search..."><button id="hide-sidebar" class="hide-sidebar" title="Hide sidebar">☷</button><button id="sidebar-close" class="sidebar-close" title="Close" aria-label="Close session tree">✕</button></div>
        <div class="sidebar-filters"><button class="filter-btn active" data-filter="default" title="Hide settings entries">Default</button><button class="filter-btn" data-filter="no-tools" title="Default minus tool results">No-tools</button><button class="filter-btn" data-filter="user-only" title="Only user messages">User</button><button class="filter-btn" data-filter="labeled-only" title="Only labeled entries">Labeled</button><button class="filter-btn" data-filter="all" title="Show everything">All</button></div>
      </div>
      <div class="tree-container" id="tree-container"></div><div class="tree-status" id="tree-status"></div>
    </aside>
    <div id="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Resize session tree sidebar"></div>
    <div id="content-container" class="content-container">
      <main id="content"><div id="header-container"></div><div id="messages">{@html firstMessageStub(entries)}</div></main>
      <form id="pi-chat-composer" class="pi-chat-composer" data-session-id={sessionId} data-chat-available={chatAvailable} data-chat-disabled-reason={chatDisabledReason}>
        <input id="pi-chat-images" name="images" type="file" accept="image/*" multiple hidden disabled={!chatAvailable}>
        <div class="pi-chat-shell">
          <button type="button" id="pi-chat-expand" class="pi-chat-expand-button" title="Expand composer" aria-label="Expand composer" aria-pressed="false" disabled={!chatAvailable}>⛶</button>
          {#if cwd}<div class="pi-chat-toolbar pi-chat-cwd-bar"><span class="pi-chat-cwd" title="Click to copy path" data-cwd={cwd}>cwd: {cwd}</span><span class="pi-chat-focus-shortcut">Shift + i to focus</span></div>{/if}
          {#if !chatAvailable}<div class="pi-chat-disabled-notice">{chatDisabledReason}</div>{/if}
          <textarea id="pi-chat-message" name="message" rows="1" placeholder="Continue this pi session…" disabled={!chatAvailable}></textarea>
          <div id="pi-chat-attachments" class="pi-chat-attachments"></div>
          <div id="pi-chat-model-popup" class="pi-chat-model-popup" style="display: none"><input type="text" id="pi-chat-model-search" class="pi-chat-model-search" placeholder="Search models…" autocomplete="off"><div id="pi-chat-model-list" class="pi-chat-model-list"></div></div>
          <div id="pi-chat-thinking-popup" class="pi-chat-thinking-popup" style="display: none"><div id="pi-chat-thinking-list" class="pi-chat-thinking-list"></div></div>
          <div id="pi-chat-slash-popup" class="pi-chat-slash-popup" style="display: none"><div id="pi-chat-slash-list" class="pi-chat-slash-list"></div></div>
          <div id="pi-chat-mention-popup" class="pi-chat-slash-popup" style="display: none"><div id="pi-chat-mention-list" class="pi-chat-slash-list"></div></div>
          <div class="pi-chat-toolbar"><div class="pi-chat-toolbar-left"><button type="button" id="pi-chat-attach" class="pi-chat-icon-button pi-chat-photo-button" title="Attach photos" aria-label="Attach photos" disabled={!chatAvailable}>▣</button><span id="pi-chat-status" class="pi-chat-status">{chatAvailable ? 'idle' : 'unavailable'}</span><button type="button" id="pi-chat-thinking-label" class="pi-chat-thinking-label" style="display: none" title="Switch effort" disabled={!chatAvailable}></button><button type="button" id="pi-chat-model-label" class="pi-chat-model-label" title="Switch model" style:display={modelLabel ? '' : 'none'} disabled={!chatAvailable}>{modelLabel}</button><div id="pi-chat-context-usage" class="pi-chat-context-usage" style="display: none" title="Click for details"><span class="pi-context-text">0%</span></div></div><div class="actions"><button type="button" id="pi-chat-cancel" class="pi-chat-cancel" style="display: none" title="Cancel running response" aria-label="Cancel running response" disabled={!chatAvailable}>Cancel</button><button type="submit" id="pi-chat-send" class="pi-chat-send" disabled>Send</button></div></div>
          <div id="pi-chat-context-popover" class="pi-chat-context-popover" style="display: none;"></div>
        </div>
        <div class="pi-git-bar" id="pi-git-bar" data-git-repo="false" data-git-branch="" data-git-default="false" data-git-has-changes="false"><div class="pi-git-branch" id="pi-git-branch" hidden><span class="pi-git-branch-name" id="pi-git-branch-name" title="Current branch"></span><button type="button" class="pi-git-edit" id="pi-git-branch-edit" title="Rename branch" aria-label="Rename branch"></button><input type="text" class="pi-git-branch-input" id="pi-git-branch-input" autocomplete="off" spellcheck="false" aria-label="New branch name" hidden></div><div class="pi-git-right"><button type="button" class="pi-git-pr-button pi-btw-button" id="pi-btw-button" title="btw">btw</button><div class="pi-git-pr" id="pi-git-pr" hidden><button type="button" class="pi-git-pr-button pi-git-primary" id="pi-git-primary"><span id="pi-git-primary-label">Create PR</span></button><button type="button" class="pi-git-pr-button pi-git-caret" id="pi-git-caret" aria-haspopup="true" aria-expanded="false" aria-label="More git actions"><span aria-hidden="true">▾</span></button><div class="pi-git-pr-menu" id="pi-git-pr-menu" role="menu" hidden><button type="button" class="pi-git-pr-item" id="pi-git-pr-view" role="menuitem" hidden>View PR ↗</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-draft" role="menuitem" hidden>Create Draft PR</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-manual" role="menuitem">Create PR manually ↗</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-merge" role="menuitem" hidden>Merge PR</button><button type="button" class="pi-git-pr-item" id="pi-git-pr-commit" role="menuitem" hidden>Commit &amp; push</button></div></div></div></div>
      </form>
    </div>
    <div id="right-sidebar-resizer" class="right-sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Resize scratchpad sidebar"></div>
    <aside id="right-sidebar" class="right-sidebar"><div class="right-sidebar-header"><div class="right-sidebar-tabs" role="tablist"><button type="button" id="right-tab-scratchpad" class="right-sidebar-tab active" role="tab" data-pane="scratchpad" aria-selected="true">Scratchpad</button><button type="button" id="right-tab-notes" class="right-sidebar-tab" role="tab" data-pane="notes" aria-selected="false">Annotations<span id="annotation-tab-count" class="right-sidebar-tab-count" hidden>0</span></button><button type="button" id="right-tab-artifacts" class="right-sidebar-tab" role="tab" data-pane="artifacts" aria-selected="false">Artifacts<span id="artifact-tab-count" class="right-sidebar-tab-count" hidden>0</span></button></div><div class="right-sidebar-actions"><button id="artifact-help-btn" class="right-sidebar-btn artifact-help-btn" title="How artifacts work" aria-label="How artifacts work">?</button><button id="expand-right-sidebar" class="right-sidebar-btn" title="Expand panel">⛶</button><button id="close-right-sidebar" class="right-sidebar-btn" title="Hide panel (⌘⇧N)">×</button></div></div><div class="right-sidebar-content"><div id="right-pane-scratchpad" class="right-sidebar-pane active" role="tabpanel" aria-labelledby="right-tab-scratchpad"><textarea id="scratchpad-textarea" class="scratchpad-textarea" placeholder="Write project-level notes, scratchpad, tasks...">{scratchpad}</textarea></div><div id="right-pane-artifacts" class="right-sidebar-pane" role="tabpanel" aria-labelledby="right-tab-artifacts" hidden><div id="artifact-panel-host" class="artifact-panel-host"></div></div><div id="right-pane-notes" class="right-sidebar-pane" role="tabpanel" aria-labelledby="right-tab-notes" hidden><div id="annotation-list-host" class="annotation-list-host"></div></div></div><div class="right-sidebar-footer"><span id="scratchpad-status" class="scratchpad-status">Saved</span></div></aside>
    <div id="right-sidebar-backdrop" class="right-sidebar-backdrop"></div>
    <div id="artifact-help-modal" class="artifact-help-modal" hidden><div class="artifact-help-backdrop" data-action="close-artifact-help"></div><div class="artifact-help-card" role="dialog" aria-modal="true" aria-labelledby="artifact-help-title"><div class="artifact-help-header"><h3 id="artifact-help-title">How artifacts work</h3><button class="artifact-help-close" data-action="close-artifact-help" aria-label="Close">&times;</button></div><div class="artifact-help-body"><p><strong>Artifacts</strong> are files and sizeable code blocks from the conversation.</p></div></div></div>
    <div id="image-modal" class="image-modal"><img id="modal-image" src="" alt=""></div>
  </div>

  <div id="share-overlay" class="share-overlay-backdrop" style="display: none;"><div id="share-dialog" class="share-dialog"><h3 id="share-title">Share session</h3><div id="share-fields"><div class="share-field"><label for="share-gist-url">Gist URL</label><input id="share-gist-url" readonly class="share-url-input"></div><div class="share-field"><label for="share-preview-url">Preview URL</label><input id="share-preview-url" readonly class="share-url-input"></div></div><p id="share-error-message" class="share-error-message" style="display: none;"></p><div class="share-actions"><button id="share-copy-gist" class="share-btn-primary" data-copy-label="Gist">Copy Gist</button><button id="share-copy-preview" class="share-btn-secondary" data-copy-label="Preview">Copy Preview</button><button id="share-close" class="share-btn-secondary">Close</button></div></div></div>
  <div id="share-copy-notice" class="toast-notice"></div>
  <script id="session-data" type="application/json">{payloadBase64}</script>
{/if}
