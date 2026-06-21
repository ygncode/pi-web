<script>
  // Session actions menu — Svelte port of live/command-menu.js. Renders the
  // desktop popover + mobile panel (+ the session-list <CommandPalette>) and, in
  // onMount, wires open/close + the action dispatch. Several actions delegate to
  // shared live runtime helpers or click hidden relay buttons (share/new/terminal).
  import { onMount } from 'svelte';
  import CommandPalette from '../shared/CommandPalette.svelte';
  import { t } from '../../shared/i18n.js';
  import {
    icon,
    Search,
    Pencil,
    Share2,
    GitFork,
    Copy,
    Terminal,
    ListTree,
    FileDiff,
    ChartColumn,
    BookOpen,
    Send,
    Settings,
    Tag,
  } from '../../shared/icons.js';
  import * as sidebarApi from '../../session/ui/sidebar.js';
  import { openVersionModal } from '../../shared/version.js';
  import { navigate } from '../../shared/navigation.js';
  import { openSessionPalette } from '../../shared/command-palette-runtime.js';
  import { openModelUsage, openFork, openDiff } from '../../session/session-modals.svelte.js';
  import { showToast } from '../../shared/toast.js';
  import { sessionTitle, setSessionTitle } from '../../session/session-title.svelte.js';
  import { USER_DOCS_URL, TELEGRAM_INVITE_URL } from '../../shared/links.js';
  import {
    cloneSession,
    forkSession,
    loadForkEntries,
    renameSession,
  } from '../../session/session-menu-actions.js';

  let { sessionId = '' } = $props();

  // Close animations must outlast the matching CSS transitions before the panel
  // is display:none'd (see command-menu styles).
  const MOBILE_PANEL_CLOSE_MS = 260;
  const DESKTOP_POPOVER_CLOSE_MS = 160;

  // Primary actions shared by the desktop popover and mobile panel. kbd hints
  // render on desktop only.
  const primaryItems = [
    { action: 'list-sessions', icon: Search, label: 'menu.searchSessions', kbd: '⌘K' },
    { action: 'rename', icon: Pencil, label: 'menu.rename' },
    { action: 'share', icon: Share2, label: 'menu.share' },
    { action: 'fork', icon: GitFork, label: 'menu.fork' },
    { action: 'clone', icon: Copy, label: 'menu.clone' },
    { action: 'terminal', icon: Terminal, label: 'menu.resumeTerminal' },
    { action: 'tree', icon: ListTree, label: 'menu.tree', kbd: '⌘B' },
    { action: 'diff', icon: FileDiff, label: 'menu.diff' },
    { action: 'model-usage', icon: ChartColumn, label: 'menu.modelUsage' },
  ];

  // Footer links/rows. desktopOnly items (the version row) are dropped on mobile.
  const footerItems = [
    { kind: 'action', action: 'user-docs', icon: BookOpen, label: 'common.userDocs' },
    {
      kind: 'link',
      href: TELEGRAM_INVITE_URL,
      external: true,
      icon: Send,
      label: 'common.telegram',
    },
    { kind: 'link', href: '/settings', icon: Settings, label: 'common.settings', kbd: '⌘,' },
    { kind: 'version', action: 'version', icon: Tag, label: 'common.version', desktopOnly: true },
  ];

  const toast = (message) => showToast(message, { id: 'command-menu-toast' });

  const clickHidden = (id) => document.getElementById(id)?.click();
  const isMobile = () => sidebarApi.isMobileLayout();

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
      }, MOBILE_PANEL_CLOSE_MS);
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
      }, DESKTOP_POPOVER_CLOSE_MS);
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
        case 'share':
          clickHidden('share-btn');
          closeMenu();
          break;
        case 'list-sessions':
          closeMenu();
          openSessionPalette();
          break;
        case 'new-session':
          clickHidden('new-btn');
          closeMenu();
          break;
        case 'terminal':
          clickHidden('resume-btn');
          closeMenu();
          break;
        case 'tree':
          if (isMobile()) sidebarApi.setSidebarOpen(true, { documentImpl: document });
          else sidebarApi.setSidebarCollapsed(false, { documentImpl: document });
          closeMenu();
          break;
        case 'model-usage':
          openModelUsage();
          closeMenu();
          break;
        case 'rename': {
          const current = sessionTitle.name;
          const next = window.prompt(t('menu.renamePrompt'), current);
          const trimmed = next ? next.trim() : '';
          closeMenu();
          if (!trimmed || trimmed === current) break;
          renameSession(sessionId, trimmed)
            .then((data) => {
              setSessionTitle((data && data.name) || trimmed);
              toast(t('menu.renamed'));
            })
            .catch(() => toast(t('git.renameFailed')));
          break;
        }
        case 'fork': {
          closeMenu();
          loadForkEntries(sessionId)
            .then((entries) => {
              const onSelect = (entryId) => {
                forkSession(sessionId, entryId)
                  .then((data) => {
                    if (data.id) navigate('/session?id=' + encodeURIComponent(data.id));
                    else toast(data.error || t('menu.forkFailed'));
                  })
                  .catch(() => toast(t('menu.forkFailed')));
              };
              const opened = openFork({ entries, onSelect });
              if (opened === false) toast(t('menu.noUserMessagesToFork'));
            })
            .catch(() => toast(t('menu.loadMessagesFailed')));
          break;
        }
        case 'clone': {
          closeMenu();
          cloneSession(sessionId)
            .then((data) => {
              if (data.id) navigate('/session?id=' + encodeURIComponent(data.id));
              else toast(data.error || t('menu.cloneFailed'));
            })
            .catch(() => toast(t('menu.cloneFailed')));
          break;
        }
        case 'version':
          closeMenu();
          openVersionModal();
          break;
        case 'user-docs':
          closeMenu();
          window.open(USER_DOCS_URL, '_blank', 'noreferrer');
          break;
        case 'diff':
          closeMenu();
          openDiff({ sessionId });
          break;
        default:
          break;
      }
    }

    const onMenuBtnClick = (e) => {
      e.stopPropagation();
      if (open) closeMenu();
      else openMenu();
    };
    const onDocClick = (e) => {
      if (!open) return;
      if (desktopPopover && desktopPopover.contains(e.target)) return;
      if (menuBtn.contains(e.target)) return;
      closeMenu();
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      }
    };
    const onContainerClick = (e) => {
      const item =
        e.target.closest('.mobile-command-item') || e.target.closest('.command-menu-item');
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
    };
  });
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG and rendered session markdown -->

{#snippet label(item)}
  <span class="menu-item-label">{@html icon(item.icon, { size: 15 })}{t(item.label)}</span>
{/snippet}

{#snippet menuBody(itemClass, sectionClass, desktop)}
  <div class={sectionClass}>
    {#each primaryItems as item (item.action)}
      <button class={itemClass} type="button" data-action={item.action}
        >{@render label(item)}{#if desktop && item.kbd}<kbd>{item.kbd}</kbd>{/if}</button
      >
    {/each}
  </div>
  <div class={sectionClass}>
    {#each footerItems as item (item.label)}
      {#if !item.desktopOnly || desktop}
        {#if item.kind === 'link'}
          <a
            class={itemClass}
            href={item.href}
            role="menuitem"
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noreferrer' : undefined}
            >{@render label(item)}{#if desktop && item.kbd}<kbd>{item.kbd}</kbd>{/if}</a
          >
        {:else if item.kind === 'version'}
          <button
            class={itemClass}
            type="button"
            data-action={item.action}
            data-version-row
            role="menuitem"
            >{@render label(item)}<span
              class="version-status"
              id="command-menu-version-status"
              data-version-status>…</span
            ></button
          >
        {:else}
          <button class={itemClass} type="button" data-action={item.action}
            >{@render label(item)}</button
          >
        {/if}
      {/if}
    {/each}
  </div>
{/snippet}

<div
  id="command-menu-popover"
  class="command-menu-popover"
  role="menu"
  aria-labelledby="command-menu-btn"
  style="display: none;"
>
  <div class="command-menu-body">
    {@render menuBody('command-menu-item', 'command-menu-section', true)}
  </div>
</div>
<div id="mobile-command-backdrop" class="mobile-command-backdrop" style="display: none;"></div>
<div id="mobile-command-panel" class="mobile-command-panel" style="display: none;">
  <div class="mobile-command-body">
    {@render menuBody('mobile-command-item', 'mobile-command-section', false)}
  </div>
</div>

<CommandPalette />
