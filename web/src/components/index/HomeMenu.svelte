<script>
  import { t } from '../../shared/i18n.js';
  import { icon, SquarePen, FolderGit2, BookOpen, Send, Settings, Tag } from '../../shared/icons.js';
  import { openVersionModal } from '../../shared/version.js';
  import { handleNavClick } from '../../shared/navigation.js';

  let { open = false, onClose = () => {}, onNewSession = () => {}, onManageProjects = () => {} } = $props();

  function handleBackdropClick(e) {
    e.stopPropagation();
    onClose();
  }
</script>

<div id="web-menu-backdrop" class="mobile-command-backdrop" class:open style:display={open ? '' : 'none'} role="button" tabindex="0" aria-label={t('common.close')} onclick={handleBackdropClick} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBackdropClick(e); }}></div>
<div id="web-menu" class="web-menu" class:open role="menu" tabindex="-1" aria-labelledby="web-menu-btn" hidden={!open} onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
  <div class="web-menu-section">
    <button class="web-menu-item" type="button" data-new-session-btn role="menuitem" onclick={() => { onClose(); onNewSession(); }}><span class="menu-item-label">{@html icon(SquarePen, { size: 15 })}{t('index.newSession')}</span></button>
    <button class="web-menu-item" type="button" id="manage-projects-btn" data-manage-projects-btn role="menuitem" onclick={() => { onClose(); onManageProjects(); }}><span class="menu-item-label">{@html icon(FolderGit2, { size: 15 })}{t('index.manageProjects')}</span></button>
  </div>
  <div class="web-menu-section">
    <a class="web-menu-item" href="https://github.com/ygncode/pi-web/tree/main/user-docs" target="_blank" rel="noreferrer" role="menuitem" onclick={onClose}><span class="menu-item-label">{@html icon(BookOpen, { size: 15 })}{t('common.userDocs')}</span></a>
    <a class="web-menu-item" href="https://t.me/+NJvFOTTa0wNjNTc9" target="_blank" rel="noreferrer" role="menuitem" onclick={onClose}><span class="menu-item-label">{@html icon(Send, { size: 15 })}{t('common.telegram')}</span></a>
    <a class="web-menu-item" href="/settings" role="menuitem" onclick={(event) => { onClose(); handleNavClick(event, '/settings'); }}><span class="menu-item-label">{@html icon(Settings, { size: 15 })}{t('common.settings')}</span><kbd>⌘,</kbd></a>
    <button class="web-menu-item" type="button" id="index-version-row" data-version-row role="menuitem" onclick={() => { onClose(); openVersionModal(); }}><span class="menu-item-label">{@html icon(Tag, { size: 15 })}{t('common.version')}</span><span class="version-status" data-version-status>…</span></button>
  </div>
</div>
