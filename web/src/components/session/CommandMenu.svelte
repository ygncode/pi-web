<script>
  // Session actions menu — Svelte port of live/command-menu.js. Renders the
  // desktop popover + mobile panel (+ the session-list <CommandPalette>) and, in
  // onMount, wires open/close + the action dispatch. Several actions delegate to
  // window bridges set by SessionPage / session.js (model-usage, fork, the
  // session-list palette) or click hidden relay buttons (share/new/terminal).
  import { onMount } from 'svelte';
  import CommandPalette from '../shared/CommandPalette.svelte';
  import { t } from '../../shared/i18n.js';
  import { icon, Search, Pencil, Share2, GitFork, Copy, Terminal, ListTree, FileDiff, ChartColumn, BookOpen, Send, Settings, Tag } from '../../shared/icons.js';
  import * as sidebarApi from '../../session/ui/sidebar.js';
  import { openVersionModal } from '../../shared/version.js';
  import { navigate } from '../../shared/navigation.js';
  import { openModelUsage, openFork } from '../../session/session-modals.svelte.js';

  let { sessionId = '' } = $props();

  const userDocsUrl = 'https://github.com/ygncode/pi-web/tree/main/user-docs';
  const chatUrl = (path, id) => `${path}?id=${encodeURIComponent(id)}`;

  let toastTimer = null;
  function showToast(message) {
    let notice = document.getElementById('command-menu-toast');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'command-menu-toast';
      notice.className = 'toast-notice';
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => notice.classList.remove('visible'), 1500);
  }

  const clickHidden = (id) => document.getElementById(id)?.click();
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

  async function renameSession(name) {
    const res = await fetch('/api/rename-session?id=' + encodeURIComponent(sessionId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'rename failed');
    return data;
  }

  onMount(() => {
    const menuBtn = document.getElementById('command-menu-btn');
    const desktopPopover = document.getElementById('command-menu-popover');
    const mobileBackdrop = document.getElementById('mobile-command-backdrop');
    const mobilePanel = document.getElementById('mobile-command-panel');
    if (!menuBtn) return;

    let open = false;

    const openMobilePanel = () => {
      if (!mobileBackdrop || !mobilePanel) return;
      mobileBackdrop.style.display = '';
      mobilePanel.style.display = '';
      requestAnimationFrame(() => {
        mobileBackdrop.classList.add('open');
        mobilePanel.classList.add('open');
      });
    };
    const closeMobilePanel = () => {
      if (!mobileBackdrop || !mobilePanel) return;
      mobileBackdrop.classList.remove('open');
      mobilePanel.classList.remove('open');
      setTimeout(() => {
        if (!mobilePanel.classList.contains('open')) {
          mobileBackdrop.style.display = 'none';
          mobilePanel.style.display = 'none';
        }
      }, 260);
    };
    const openDesktopPopover = () => {
      if (!desktopPopover) return;
      desktopPopover.style.display = '';
      requestAnimationFrame(() => desktopPopover.classList.add('open'));
    };
    const closeDesktopPopover = () => {
      if (!desktopPopover) return;
      desktopPopover.classList.remove('open');
      setTimeout(() => {
        if (!desktopPopover.classList.contains('open')) desktopPopover.style.display = 'none';
      }, 160);
    };

    const openMenu = () => {
      open = true;
      menuBtn.setAttribute('aria-expanded', 'true');
      if (isMobile()) openMobilePanel();
      else openDesktopPopover();
    };
    const closeMenu = () => {
      open = false;
      menuBtn.setAttribute('aria-expanded', 'false');
      closeMobilePanel();
      closeDesktopPopover();
    };

    function handleAction(action) {
      switch (action) {
        case 'share': clickHidden('share-btn'); closeMenu(); break;
        case 'list-sessions': closeMenu(); window.__piOpenSessionPalette?.(); break;
        case 'new-session': clickHidden('new-btn'); closeMenu(); break;
        case 'terminal': clickHidden('resume-btn'); closeMenu(); break;
        case 'tree':
          if (isMobile()) sidebarApi.setSidebarOpen(true, { documentImpl: document });
          else sidebarApi.setSidebarCollapsed(false, { documentImpl: document });
          closeMenu();
          break;
        case 'model-usage': openModelUsage(); closeMenu(); break;
        case 'rename': {
          const titleEl = document.getElementById('session-header-title');
          const current = titleEl ? titleEl.textContent : '';
          const next = window.prompt('Rename session', current);
          const trimmed = next ? next.trim() : '';
          closeMenu();
          if (!trimmed || trimmed === current) break;
          renameSession(trimmed)
            .then((data) => {
              const savedName = (data && data.name) || trimmed;
              if (titleEl) titleEl.textContent = savedName;
              document.title = savedName;
              showToast('Renamed');
            })
            .catch(() => showToast('Rename failed'));
          break;
        }
        case 'fork': {
          closeMenu();
          // Fetch fresh entries — the in-memory model is stale after live reload.
          fetch(chatUrl('/api/session', sessionId))
            .then((res) => res.json())
            .then((data) => {
              const entries = data.entries || [];
              const onSelect = (entryId) => {
                fetch(chatUrl('/api/fork-session', sessionId), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ entryId }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data.id) navigate('/session?id=' + encodeURIComponent(data.id));
                    else showToast(data.error || 'Fork failed');
                  })
                  .catch(() => showToast('Fork failed'));
              };
              const opened = openFork({ entries, onSelect });
              if (opened === false) showToast('No user messages to fork from');
            })
            .catch(() => showToast('Failed to load messages'));
          break;
        }
        case 'clone': {
          closeMenu();
          fetch(chatUrl('/api/clone-session', sessionId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.id) navigate('/session?id=' + encodeURIComponent(data.id));
              else showToast(data.error || 'Clone failed');
            })
            .catch(() => showToast('Clone failed'));
          break;
        }
        case 'version': closeMenu(); openVersionModal(); break;
        case 'user-docs': closeMenu(); window.open(userDocsUrl, '_blank', 'noreferrer'); break;
        case 'diff': showToast('Not yet implemented'); closeMenu(); break;
        default: break;
      }
    }

    const onMenuBtnClick = (e) => { e.stopPropagation(); if (open) closeMenu(); else openMenu(); };
    const onDocClick = (e) => {
      if (!open) return;
      if (desktopPopover && desktopPopover.contains(e.target)) return;
      if (menuBtn.contains(e.target)) return;
      closeMenu();
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); closeMenu(); }
    };
    const onContainerClick = (e) => {
      const item = e.target.closest('.mobile-command-item') || e.target.closest('.command-menu-item');
      if (item?.dataset.action) handleAction(item.dataset.action);
    };
    const containers = [mobilePanel, desktopPopover].filter(Boolean);

    menuBtn.addEventListener('click', onMenuBtnClick);
    mobileBackdrop?.addEventListener('click', closeMenu);
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    containers.forEach((c) => c.addEventListener('click', onContainerClick));

    return () => {
      menuBtn.removeEventListener('click', onMenuBtnClick);
      mobileBackdrop?.removeEventListener('click', closeMenu);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      containers.forEach((c) => c.removeEventListener('click', onContainerClick));
      clearTimeout(toastTimer);
    };
  });
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
