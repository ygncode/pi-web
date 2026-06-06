<script>
  import CommandPalette from '../shared/CommandPalette.svelte';
  import { t } from '../../shared/i18n.js';
</script>

<div id="command-menu-popover" class="command-menu-popover" role="menu" aria-labelledby="command-menu-btn" style="display: none;">
  <div class="command-menu-body">
    <button class="command-menu-item" type="button" data-action="list-sessions">{t('menu.searchSessions')} <kbd>⌘K</kbd></button>
    <button class="command-menu-item" type="button" data-action="rename">{t('menu.rename')}</button>
    <button class="command-menu-item" type="button" data-action="share">{t('menu.share')}</button>
    <button class="command-menu-item" type="button" data-action="fork">{t('menu.fork')}</button>
    <button class="command-menu-item" type="button" data-action="clone">{t('menu.clone')}</button>
    <button class="command-menu-item" type="button" data-action="terminal">{t('menu.resumeTerminal')}</button>
    <button class="command-menu-item" type="button" data-action="tree">{t('menu.tree')} <kbd>⌘B</kbd></button>
    <button class="command-menu-item" type="button" data-action="diff">{t('menu.diff')}</button>
    <button class="command-menu-item" type="button" data-action="model-usage">{t('menu.modelUsage')}</button>
    <a class="command-menu-item" href="/settings" role="menuitem"><span>{t('common.settings')}</span><kbd>⌘,</kbd></a>
    <button class="command-menu-item" type="button" data-action="version" data-version-row role="menuitem"><span>{t('common.version')}</span><span class="version-status" id="command-menu-version-status" data-version-status>…</span></button>
  </div>
</div>
<div id="mobile-command-backdrop" class="mobile-command-backdrop" style="display: none;"></div>
<div id="mobile-command-panel" class="mobile-command-panel" style="display: none;">
  <div class="mobile-command-body">
    <button class="mobile-command-item" type="button" data-action="list-sessions">{t('menu.searchSessions')}</button>
    <button class="mobile-command-item" type="button" data-action="rename">{t('menu.rename')}</button>
    <button class="mobile-command-item" type="button" data-action="share">{t('menu.share')}</button>
    <button class="mobile-command-item" type="button" data-action="fork">{t('menu.fork')}</button>
    <button class="mobile-command-item" type="button" data-action="clone">{t('menu.clone')}</button>
    <button class="mobile-command-item" type="button" data-action="terminal">{t('menu.resumeTerminal')}</button>
    <button class="mobile-command-item" type="button" data-action="tree">{t('menu.tree')}</button>
    <button class="mobile-command-item" type="button" data-action="diff">{t('menu.diff')}</button>
    <button class="mobile-command-item" type="button" data-action="model-usage">{t('menu.modelUsage')}</button>
    <a class="mobile-command-item" href="/settings" role="menuitem">{t('common.settings')}</a>
  </div>
</div>

<CommandPalette />
