<script>
  import { t } from '../../shared/i18n.js';
  import { formatRelativeTime, formatRunningModel, sessionModelLabel, sessionSearchText } from '../../index/sessions.js';

  let { session, running = false, runningStatus = null, now = Date.now() } = $props();

  const href = $derived(`/session?id=${encodeURIComponent(session.id || '')}`);
  const title = $derived(session.name || session.id || '');
  const modelLabel = $derived(formatRunningModel(runningStatus) || sessionModelLabel(session));
  const runningModel = $derived(running ? formatRunningModel(runningStatus) : '');
  const search = $derived(sessionSearchText(session));
</script>

<a
  class="session-card"
  class:session-card--running={running}
  href={href}
  data-id={session.id}
  data-session-id={session.id}
  data-search={search}
>
  <div class="session-title-row">
    <div class="session-title">{title}</div>
    <div class="session-card-flags">
      {#if !session.chatAvailable}
        <span class="session-card-badge" title={session.chatDisabledReason || t('composer.disabledNotice')}>{t('index.viewOnly')}</span>
      {/if}
    </div>
  </div>
  <div class="session-project">{session.project}</div>
  <div class="session-model" data-session-model>{modelLabel}</div>
  <div class="session-meta">
    <span class="session-active-status" data-running-status><span aria-hidden="true">●</span> {t('index.active')}</span>
    <span class="session-time" data-timestamp={session.lastActivity} title={session.lastActivity}>{formatRelativeTime(session.lastActivity, now)}</span>
    <span class="session-run-model" data-running-model>{runningModel}</span>
  </div>
</a>
