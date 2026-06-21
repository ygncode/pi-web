<script>
  import { onMount } from 'svelte';
  import { icon, PanelLeft, Plus, SquarePen, MoreHorizontal } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
  import { navigate, handleNavClick } from '../../shared/navigation.js';
  import { showToast } from '../../shared/toast.js';
  import { copyToClipboard } from '../../shared/clipboard.js';
  import { sessionTitle, setSessionTitle } from '../../session/session-title.svelte.js';
  let { title = 'Session', cwd = '', sessionId = '' } = $props();

  // The title prop seeds the shared store (and re-seeds it on session switch);
  // renames/auto-titling update the store, which this component renders and
  // mirrors into document.title.
  $effect(() => setSessionTitle(title));
  $effect(() => {
    if (sessionTitle.name) document.title = sessionTitle.name;
  });

  // Resume ("Terminal") + New Session behavior, absorbed from the former
  // live/resume-button.js and live/new-session-button.js (Svelte migration
  // Phase 3). These are hidden command-relay buttons that the command menu and
  // header buttons .click() by id; live-only (export omits this header).

  async function copyText(text, onCopied) {
    if (await copyToClipboard(text)) onCopied();
  }

  // Passive "Copied" toast — does NOT mutate the resume button's own text.
  function showResumeCopiedNotice(command) {
    showToast(t('common.copied'), { id: 'resume-copy-notice', duration: 1200, title: command });
  }

  const newSessionToast = (text) => showToast(text, { id: 'new-session-toast', duration: 2500 });

  onMount(() => {
    const resumeBtn = document.getElementById('resume-btn');
    const newBtn = document.getElementById('new-btn');

    const onResume = () => {
      const resumeSessionArg = document.body.dataset.sessionUuid;
      const command = 'pi --session ' + resumeSessionArg;
      copyText(command, () => showResumeCopiedNotice(command));
    };

    const onNew = async () => {
      if (!cwd) {
        newSessionToast('No working directory available for this session');
        return;
      }
      const originalHTML = newBtn.innerHTML;
      newBtn.innerHTML = '<span class="working-dots"></span>';
      newBtn.disabled = true;
      try {
        const response = await fetch('/api/new-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: cwd, sourceSessionId: sessionId }),
        });
        const data = await response.json();
        if (data.error) {
          newSessionToast(data.error || 'Failed to create session');
        } else if (data.id) {
          navigate('/session?id=' + encodeURIComponent(data.id));
          return;
        } else {
          newSessionToast('Failed to create session');
        }
      } catch (err) {
        newSessionToast(err.message || 'Network error');
      }
      newBtn.innerHTML = originalHTML;
      newBtn.disabled = false;
    };

    resumeBtn?.addEventListener('click', onResume);
    newBtn?.addEventListener('click', onNew);
    return () => {
      resumeBtn?.removeEventListener('click', onResume);
      newBtn?.removeEventListener('click', onNew);
    };
  });
</script>

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG and rendered session markdown -->

<div style="display:none">
  <button id="theme-toggle" title="Toggle light/dark theme">Theme</button>
  <button id="notify-toggle" title="Notify when response is ready" aria-pressed="false"
    >Notify</button
  >
  <button id="resume-btn" title="Copy pi --session command to clipboard">Terminal</button>
  <button id="new-btn" title="New Session">Session</button>
  <button id="share-btn" title="Share session as GitHub Gist">Share</button>
</div>

<div class="session-header-bar">
  <div class="session-header-left">
    <a href="/" class="session-header-back" onclick={(event) => handleNavClick(event, '/')}
      ><span>←</span> {t('session.back')}</a
    >
    <button
      id="tree-toggle"
      class="session-header-actions session-header-tree-toggle"
      title={t('session.toggleTree')}
      aria-label={t('session.toggleTree')}
      aria-pressed="true">{@html icon(PanelLeft, { size: 14 })}</button
    >
  </div>
  <span class="session-header-title" id="session-header-title">{sessionTitle.name || title}</span>
  <div class="session-header-right">
    <button
      id="new-session-header-btn"
      class="session-header-new"
      title={`${t('index.newSession')} (⌘T)`}
      aria-label={t('session.newSession')}
      >{@html icon(Plus, { size: 14 })}<span class="session-header-new-label"
        >{t('session.new')}</span
      ></button
    >
    <button
      id="shortcuts-help-btn"
      class="session-header-shortcuts-help"
      title={`${t('session.shortcuts')} (⌘/)`}>⌘/</button
    >
    <button
      id="toggle-right-sidebar-btn"
      class="session-header-actions"
      title={`${t('session.toggleScratchpad')} (⌘⇧N)`}
      aria-label={t('session.toggleScratchpad')}>{@html icon(SquarePen, { size: 14 })}</button
    >
    <button
      id="command-menu-btn"
      class="session-header-actions"
      aria-label={t('session.actions')}
      aria-haspopup="menu"
      aria-expanded="false"
      aria-controls="command-menu-popover">{@html icon(MoreHorizontal, { size: 16 })}</button
    >
  </div>
</div>
