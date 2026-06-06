<script>
  import { icon, PanelLeft, Plus, SquarePen, MoreHorizontal } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
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
    <a href="/" class="session-header-back"><span>←</span> {t('session.back')}</a>
    <button id="tree-toggle" class="session-header-actions session-header-tree-toggle" title={t('session.toggleTree')} aria-label={t('session.toggleTree')} aria-pressed="true">{@html icon(PanelLeft, { size: 14 })}</button>
  </div>
  <span class="session-header-title" id="session-header-title">{title}</span>
  <div class="session-header-right">
    <button id="new-session-header-btn" class="session-header-new" title={`${t('index.newSession')} (⌘T)`} aria-label={t('session.newSession')}>{@html icon(Plus, { size: 14 })}<span class="session-header-new-label">{t('session.new')}</span></button>
    <button id="shortcuts-help-btn" class="session-header-shortcuts-help" title={`${t('session.shortcuts')} (⌘/)`}>⌘/</button>
    <button id="toggle-right-sidebar-btn" class="session-header-actions" title={`${t('session.toggleScratchpad')} (⌘⇧N)`} aria-label={t('session.toggleScratchpad')}>{@html icon(SquarePen, { size: 14 })}</button>
    <button id="command-menu-btn" class="session-header-actions" aria-label={t('session.actions')} aria-haspopup="menu" aria-expanded="false" aria-controls="command-menu-popover">{@html icon(MoreHorizontal, { size: 16 })}</button>
  </div>
</div>
