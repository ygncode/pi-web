<script>
  let { title = 'Session' } = $props();
</script>

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
