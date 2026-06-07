<script>
  import { onMount } from 'svelte';
  import { icon, PanelLeft, Plus, SquarePen, MoreHorizontal } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
  import { navigate } from '../../shared/navigation.js';
  let { title = 'Session', cwd = '', sessionId = '' } = $props();

  // Resume ("Terminal") + New Session behavior, absorbed from the former
  // live/resume-button.js and live/new-session-button.js (Svelte migration
  // Phase 3). These are hidden command-relay buttons that the command menu and
  // header buttons .click() by id; live-only (export omits this header).
  function showToast(id, text, holder, duration) {
    let notice = document.getElementById(id);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = id;
      notice.className = 'toast-notice';
      document.body.appendChild(notice);
    }
    notice.textContent = text;
    clearTimeout(holder.timer);
    notice.classList.add('visible');
    holder.timer = setTimeout(() => notice.classList.remove('visible'), duration);
    return notice;
  }

  // Copy with a clipboard guard + execCommand fallback for insecure contexts.
  function copyText(text, onCopied) {
    function fallbackCopy() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) onCopied();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onCopied).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  // Passive "Copied" toast — does NOT mutate the resume button's own text.
  function showResumeCopiedNotice(command, holder) {
    const notice = showToast('resume-copy-notice', t('common.copied'), holder, 1200);
    notice.title = command;
  }

  onMount(() => {
    const resumeBtn = document.getElementById('resume-btn');
    const newBtn = document.getElementById('new-btn');
    const resumeHolder = {};
    const newHolder = {};

    const onResume = () => {
      const resumeSessionArg = document.body.dataset.sessionUuid;
      const command = 'pi --session ' + resumeSessionArg;
      copyText(command, () => showResumeCopiedNotice(command, resumeHolder));
    };

    const onNew = async () => {
      if (!cwd) {
        showToast('new-session-toast', 'No working directory available for this session', newHolder, 2500);
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
          showToast('new-session-toast', data.error || 'Failed to create session', newHolder, 2500);
        } else if (data.id) {
          navigate('/session?id=' + encodeURIComponent(data.id));
          return;
        } else {
          showToast('new-session-toast', 'Failed to create session', newHolder, 2500);
        }
      } catch (err) {
        showToast('new-session-toast', err.message || 'Network error', newHolder, 2500);
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
