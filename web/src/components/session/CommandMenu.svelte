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
