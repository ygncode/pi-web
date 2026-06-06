<script>
  import CommandPalette from '../shared/CommandPalette.svelte';
  import { t } from '../../shared/i18n.js';
  import { icon, Search, Pencil, Share2, GitFork, Copy, Terminal, ListTree, FileDiff, ChartColumn, BookOpen, Send, Settings, Tag } from '../../shared/icons.js';
</script>

<div id="command-menu-popover" class="command-menu-popover" role="menu" aria-labelledby="command-menu-btn" style="display: none;">
  <div class="command-menu-body">
    <div class="command-menu-section">
      <button class="command-menu-item" type="button" data-action="list-sessions"><span class="menu-item-label">{@html icon(Search, { size: 15 })}{t('menu.searchSessions')}</span><kbd>⌘K</kbd></button>
      <button class="command-menu-item" type="button" data-action="rename"><span class="menu-item-label">{@html icon(Pencil, { size: 15 })}{t('menu.rename')}</span></button>
      <button class="command-menu-item" type="button" data-action="share"><span class="menu-item-label">{@html icon(Share2, { size: 15 })}{t('menu.share')}</span></button>
      <button class="command-menu-item" type="button" data-action="fork"><span class="menu-item-label">{@html icon(GitFork, { size: 15 })}{t('menu.fork')}</span></button>
      <button class="command-menu-item" type="button" data-action="clone"><span class="menu-item-label">{@html icon(Copy, { size: 15 })}{t('menu.clone')}</span></button>
      <button class="command-menu-item" type="button" data-action="terminal"><span class="menu-item-label">{@html icon(Terminal, { size: 15 })}{t('menu.resumeTerminal')}</span></button>
      <button class="command-menu-item" type="button" data-action="tree"><span class="menu-item-label">{@html icon(ListTree, { size: 15 })}{t('menu.tree')}</span><kbd>⌘B</kbd></button>
      <button class="command-menu-item" type="button" data-action="diff"><span class="menu-item-label">{@html icon(FileDiff, { size: 15 })}{t('menu.diff')}</span></button>
      <button class="command-menu-item" type="button" data-action="model-usage"><span class="menu-item-label">{@html icon(ChartColumn, { size: 15 })}{t('menu.modelUsage')}</span></button>
    </div>
    <div class="command-menu-section">
      <button class="command-menu-item" type="button" data-action="user-docs"><span class="menu-item-label">{@html icon(BookOpen, { size: 15 })}{t('common.userDocs')}</span></button>
      <a class="command-menu-item" href="https://t.me/+NJvFOTTa0wNjNTc9" target="_blank" rel="noreferrer" role="menuitem"><span class="menu-item-label">{@html icon(Send, { size: 15 })}{t('common.telegram')}</span></a>
      <a class="command-menu-item" href="/settings" role="menuitem"><span class="menu-item-label">{@html icon(Settings, { size: 15 })}{t('common.settings')}</span><kbd>⌘,</kbd></a>
      <button class="command-menu-item" type="button" data-action="version" data-version-row role="menuitem"><span class="menu-item-label">{@html icon(Tag, { size: 15 })}{t('common.version')}</span><span class="version-status" id="command-menu-version-status" data-version-status>…</span></button>
    </div>
  </div>
</div>
<div id="mobile-command-backdrop" class="mobile-command-backdrop" style="display: none;"></div>
<div id="mobile-command-panel" class="mobile-command-panel" style="display: none;">
  <div class="mobile-command-body">
    <div class="mobile-command-section">
      <button class="mobile-command-item" type="button" data-action="list-sessions"><span class="menu-item-label">{@html icon(Search, { size: 15 })}{t('menu.searchSessions')}</span></button>
      <button class="mobile-command-item" type="button" data-action="rename"><span class="menu-item-label">{@html icon(Pencil, { size: 15 })}{t('menu.rename')}</span></button>
      <button class="mobile-command-item" type="button" data-action="share"><span class="menu-item-label">{@html icon(Share2, { size: 15 })}{t('menu.share')}</span></button>
      <button class="mobile-command-item" type="button" data-action="fork"><span class="menu-item-label">{@html icon(GitFork, { size: 15 })}{t('menu.fork')}</span></button>
      <button class="mobile-command-item" type="button" data-action="clone"><span class="menu-item-label">{@html icon(Copy, { size: 15 })}{t('menu.clone')}</span></button>
      <button class="mobile-command-item" type="button" data-action="terminal"><span class="menu-item-label">{@html icon(Terminal, { size: 15 })}{t('menu.resumeTerminal')}</span></button>
      <button class="mobile-command-item" type="button" data-action="tree"><span class="menu-item-label">{@html icon(ListTree, { size: 15 })}{t('menu.tree')}</span></button>
      <button class="mobile-command-item" type="button" data-action="diff"><span class="menu-item-label">{@html icon(FileDiff, { size: 15 })}{t('menu.diff')}</span></button>
      <button class="mobile-command-item" type="button" data-action="model-usage"><span class="menu-item-label">{@html icon(ChartColumn, { size: 15 })}{t('menu.modelUsage')}</span></button>
    </div>
    <div class="mobile-command-section">
      <button class="mobile-command-item" type="button" data-action="user-docs"><span class="menu-item-label">{@html icon(BookOpen, { size: 15 })}{t('common.userDocs')}</span></button>
      <a class="mobile-command-item" href="https://t.me/+NJvFOTTa0wNjNTc9" target="_blank" rel="noreferrer" role="menuitem"><span class="menu-item-label">{@html icon(Send, { size: 15 })}{t('common.telegram')}</span></a>
      <a class="mobile-command-item" href="/settings" role="menuitem"><span class="menu-item-label">{@html icon(Settings, { size: 15 })}{t('common.settings')}</span></a>
    </div>
  </div>
</div>

<CommandPalette />
