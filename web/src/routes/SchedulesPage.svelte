<script>
  import { onMount } from 'svelte';
  import { navigate } from '../shared/navigation.js';
  import { t } from '../shared/i18n.js';
  import {
    groupModelsByProvider,
    modelDisplayLabel,
    THINKING_LEVELS,
  } from '../session/chat/chat-selectors.js';
  import {
    FREQUENCIES,
    buildCron,
    parseCron,
    describeFrequency,
    guessTimezone,
    defaultFetchSchedules,
    defaultFetchScheduleRuns,
    defaultCreateSchedule,
    defaultUpdateSchedule,
    defaultRunSchedule,
    defaultDeleteSchedule,
    defaultFetchModels,
    defaultFetchRecent,
  } from '../index/schedules.js';

  let schedules = $state([]);
  let loading = $state(true);
  let loadError = $state('');
  let models = $state([]);
  let recent = $state([]);

  let editorOpen = $state(false);
  let editingId = $state('');
  let saving = $state(false);
  let formError = $state('');

  let modelFilter = $state('');
  let modelPickerOpen = $state(false);

  let expandedId = $state('');
  let runs = $state([]);
  let runsLoading = $state(false);

  const blankForm = () => ({
    name: '',
    instructions: '',
    modelProvider: '',
    modelId: '',
    modelLabel: '',
    thinkingLevel: '',
    projectPath: '',
    frequency: 'daily',
    minute: 0,
    hour: 9,
    weekday: 1,
    customCron: '',
    timezone: guessTimezone(),
    enabled: true,
  });
  let form = $state(blankForm());

  const filteredProviders = $derived.by(() => {
    const byProvider = groupModelsByProvider(models, modelFilter);
    return Object.keys(byProvider)
      .sort()
      .map((provider) => ({ provider, models: byProvider[provider] }));
  });

  const showTime = $derived(['daily', 'weekdays', 'weekly'].includes(form.frequency));
  const timeValue = $derived(
    `${String(form.hour).padStart(2, '0')}:${String(form.minute).padStart(2, '0')}`,
  );

  async function refresh() {
    loading = true;
    loadError = '';
    try {
      const data = await defaultFetchSchedules();
      schedules = Array.isArray(data.schedules) ? data.schedules : [];
    } catch (err) {
      loadError = err.message || String(err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    refresh();
    defaultFetchModels()
      .then((data) => {
        models = Array.isArray(data.models) ? data.models : [];
      })
      .catch(() => {});
    defaultFetchRecent()
      .then((data) => {
        recent = Array.isArray(data.locations) ? data.locations : [];
      })
      .catch(() => {});
  });

  function openCreate() {
    editingId = '';
    form = blankForm();
    formError = '';
    modelFilter = '';
    modelPickerOpen = false;
    editorOpen = true;
  }

  function openEdit(schedule) {
    editingId = schedule.id;
    const parsed = parseCron(schedule.cronExpr);
    form = {
      name: schedule.name || '',
      instructions: schedule.instructions || '',
      modelProvider: schedule.modelProvider || '',
      modelId: schedule.modelId || '',
      modelLabel: schedule.modelId
        ? modelDisplayLabel({ provider: schedule.modelProvider, id: schedule.modelId })
        : '',
      thinkingLevel: schedule.thinkingLevel || '',
      projectPath: schedule.projectPath || '',
      frequency: parsed.frequency,
      minute: parsed.minute,
      hour: parsed.hour,
      weekday: parsed.weekday,
      customCron: parsed.frequency === 'custom' ? schedule.cronExpr || '' : '',
      timezone: schedule.timezone || guessTimezone(),
      enabled: schedule.enabled,
    };
    formError = '';
    modelFilter = '';
    modelPickerOpen = false;
    editorOpen = true;
  }

  function closeEditor() {
    editorOpen = false;
    editingId = '';
  }

  function onTimeInput(event) {
    const value = event.target.value || '';
    const [h, m] = value.split(':');
    const hour = Number.parseInt(h, 10);
    const minute = Number.parseInt(m, 10);
    if (Number.isFinite(hour)) form.hour = hour;
    if (Number.isFinite(minute)) form.minute = minute;
  }

  function selectModel(provider, model) {
    const id = model.id || model.modelId || '';
    form.modelProvider = provider;
    form.modelId = id;
    form.modelLabel = modelDisplayLabel(model, id);
    modelPickerOpen = false;
  }

  function clearModel() {
    form.modelProvider = '';
    form.modelId = '';
    form.modelLabel = '';
    modelPickerOpen = false;
  }

  function cronForForm() {
    if (form.frequency === 'manual') return '';
    if (form.frequency === 'custom') return form.customCron.trim();
    return buildCron(form);
  }

  async function save() {
    formError = '';
    if (!form.name.trim()) {
      formError = t('schedules.errNameRequired');
      return;
    }
    if (!form.instructions.trim()) {
      formError = t('schedules.errInstructionsRequired');
      return;
    }
    if (form.frequency === 'custom' && !form.customCron.trim()) {
      formError = t('schedules.errCronRequired');
      return;
    }
    const payload = {
      name: form.name.trim(),
      instructions: form.instructions,
      modelProvider: form.modelProvider,
      modelId: form.modelId,
      thinkingLevel: form.thinkingLevel,
      projectPath: form.projectPath.trim(),
      cronExpr: cronForForm(),
      timezone: form.frequency === 'manual' ? '' : form.timezone.trim(),
      enabled: form.enabled,
    };
    saving = true;
    try {
      if (editingId) {
        await defaultUpdateSchedule(editingId, payload);
      } else {
        await defaultCreateSchedule(payload);
      }
      closeEditor();
      await refresh();
    } catch (err) {
      formError = err.message || String(err);
    } finally {
      saving = false;
    }
  }

  async function toggleEnabled(schedule) {
    try {
      await defaultUpdateSchedule(schedule.id, {
        name: schedule.name,
        instructions: schedule.instructions,
        modelProvider: schedule.modelProvider,
        modelId: schedule.modelId,
        thinkingLevel: schedule.thinkingLevel,
        projectPath: schedule.projectPath,
        cronExpr: schedule.cronExpr,
        timezone: schedule.timezone,
        enabled: !schedule.enabled,
      });
      await refresh();
    } catch (err) {
      loadError = err.message || String(err);
    }
  }

  async function runNow(schedule) {
    try {
      const data = await defaultRunSchedule(schedule.id);
      if (data && data.sessionId) {
        navigate('/session?id=' + encodeURIComponent(data.sessionId));
      }
    } catch (err) {
      loadError = err.message || String(err);
    }
  }

  async function remove(schedule) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(t('schedules.confirmDelete', { name: schedule.name }))
    ) {
      return;
    }
    try {
      await defaultDeleteSchedule(schedule.id);
      if (expandedId === schedule.id) expandedId = '';
      await refresh();
    } catch (err) {
      loadError = err.message || String(err);
    }
  }

  async function toggleRuns(schedule) {
    if (expandedId === schedule.id) {
      expandedId = '';
      return;
    }
    expandedId = schedule.id;
    runs = [];
    runsLoading = true;
    try {
      const data = await defaultFetchScheduleRuns(schedule.id);
      runs = Array.isArray(data.runs) ? data.runs : [];
    } catch (err) {
      loadError = err.message || String(err);
    } finally {
      runsLoading = false;
    }
  }

  function fmtTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  function freqLabel(schedule) {
    return describeFrequency(schedule, t);
  }
</script>

<div class="schedules-page">
  <header class="schedules-header">
    <button type="button" class="link-btn" onclick={() => navigate('/')}>
      {t('schedules.backToSessions')}
    </button>
    <h1>{t('schedules.title')}</h1>
    <button type="button" class="primary-btn" data-testid="schedule-new" onclick={openCreate}
      >{t('schedules.new')}</button
    >
  </header>

  {#if loadError}
    <p class="error" role="alert">{loadError}</p>
  {/if}

  {#if loading}
    <p class="muted">{t('schedules.loading')}</p>
  {:else if schedules.length === 0}
    <div class="empty">
      <p>{t('schedules.emptyTitle')}</p>
      <p class="muted">{t('schedules.emptyHint')}</p>
    </div>
  {:else}
    <ul class="schedule-list">
      {#each schedules as schedule (schedule.id)}
        <li
          class="schedule-card"
          class:disabled={!schedule.enabled}
          data-testid="schedule-card"
          data-schedule-id={schedule.id}
        >
          <div class="schedule-main">
            <div class="schedule-info">
              <div class="schedule-name" data-testid="schedule-card-name">
                {schedule.name}
                {#if !schedule.enabled}<span class="badge">{t('schedules.paused')}</span>{/if}
              </div>
              <div class="schedule-meta">
                <span>{freqLabel(schedule)}</span>
                {#if schedule.nextRunAt}
                  <span class="muted">· {t('schedules.next')}: {fmtTime(schedule.nextRunAt)}</span>
                {/if}
                {#if schedule.lastRunAt}
                  <span class="muted">· {t('schedules.last')}: {fmtTime(schedule.lastRunAt)}</span>
                {/if}
              </div>
              {#if schedule.projectPath}
                <div class="schedule-path muted">{schedule.projectPath}</div>
              {/if}
            </div>
            <div class="schedule-actions">
              <button
                type="button"
                class="small-btn"
                data-testid="schedule-run"
                onclick={() => runNow(schedule)}
              >
                {t('schedules.runNow')}
              </button>
              <button
                type="button"
                class="small-btn"
                data-testid="schedule-toggle"
                onclick={() => toggleEnabled(schedule)}
              >
                {schedule.enabled ? t('schedules.pause') : t('schedules.resume')}
              </button>
              <button
                type="button"
                class="small-btn"
                data-testid="schedule-edit"
                onclick={() => openEdit(schedule)}
              >
                {t('schedules.edit')}
              </button>
              <button
                type="button"
                class="small-btn"
                data-testid="schedule-runs"
                onclick={() => toggleRuns(schedule)}
              >
                {t('schedules.runs')}
              </button>
              <button
                type="button"
                class="small-btn danger"
                data-testid="schedule-delete"
                onclick={() => remove(schedule)}
              >
                {t('schedules.delete')}
              </button>
            </div>
          </div>

          {#if expandedId === schedule.id}
            <div class="run-log">
              {#if runsLoading}
                <p class="muted">{t('schedules.loading')}</p>
              {:else if runs.length === 0}
                <p class="muted">{t('schedules.noRuns')}</p>
              {:else}
                <ul data-testid="run-log">
                  {#each runs as run (run.id)}
                    <li class="run-row" data-testid="run-row">
                      <span class="run-time">{fmtTime(run.firedAt)}</span>
                      {#if run.status === 'error'}
                        <span class="run-status error">{t('schedules.runError')}: {run.error}</span>
                      {:else if run.sessionId}
                        <button
                          type="button"
                          class="link-btn"
                          data-testid="run-open"
                          onclick={() =>
                            navigate('/session?id=' + encodeURIComponent(run.sessionId))}
                        >
                          {t('schedules.openSession')}
                        </button>
                      {:else}
                        <span class="muted">{t('schedules.runStarted')}</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if editorOpen}
  <div class="editor-backdrop" role="presentation" onclick={closeEditor}></div>
  <div class="editor" role="dialog" aria-modal="true" aria-label={t('schedules.editorTitle')}>
    <h2>{editingId ? t('schedules.editTitle') : t('schedules.new')}</h2>

    <label class="field">
      <span>{t('schedules.fieldName')}</span>
      <input
        type="text"
        data-testid="schedule-name"
        bind:value={form.name}
        placeholder={t('schedules.namePlaceholder')}
      />
    </label>

    <label class="field">
      <span>{t('schedules.fieldInstructions')}</span>
      <textarea
        rows="4"
        data-testid="schedule-instructions"
        bind:value={form.instructions}
        placeholder={t('schedules.instructionsPlaceholder')}
      ></textarea>
    </label>

    <label class="field">
      <span>{t('schedules.fieldProject')}</span>
      <input
        type="text"
        data-testid="schedule-project"
        bind:value={form.projectPath}
        list="schedule-recent-paths"
        placeholder={t('schedules.projectPlaceholder')}
      />
      <datalist id="schedule-recent-paths">
        {#each recent as loc (loc.path || loc)}
          <option value={loc.path || loc}></option>
        {/each}
      </datalist>
    </label>

    <div class="field">
      <span>{t('schedules.fieldModel')}</span>
      <div class="model-select">
        <button
          type="button"
          class="model-trigger"
          onclick={() => (modelPickerOpen = !modelPickerOpen)}
        >
          {form.modelLabel || t('schedules.modelDefault')}
        </button>
        {#if form.modelId}
          <button type="button" class="small-btn" onclick={clearModel}
            >{t('schedules.modelClear')}</button
          >
        {/if}
      </div>
      {#if modelPickerOpen}
        <div class="model-popup">
          <input
            type="text"
            class="model-search"
            bind:value={modelFilter}
            placeholder={t('schedules.modelSearch')}
          />
          <div class="model-list">
            {#if filteredProviders.length === 0}
              <div class="muted">{t('schedules.modelNone')}</div>
            {:else}
              {#each filteredProviders as group (group.provider)}
                <div class="model-provider">{group.provider}</div>
                {#each group.models as model (model.id || model.modelId)}
                  <button
                    type="button"
                    class="model-item"
                    onclick={() => selectModel(group.provider, model)}
                  >
                    {model.name || model.id || model.modelId}
                  </button>
                {/each}
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <label class="field">
      <span>{t('schedules.fieldThinking')}</span>
      <select bind:value={form.thinkingLevel}>
        <option value="">{t('schedules.thinkingDefault')}</option>
        {#each THINKING_LEVELS as level (level)}
          <option value={level}>{level}</option>
        {/each}
      </select>
    </label>

    <label class="field">
      <span>{t('schedules.fieldFrequency')}</span>
      <select data-testid="schedule-frequency" bind:value={form.frequency}>
        {#each FREQUENCIES as freq (freq)}
          <option value={freq}>{t('schedules.freq_' + freq)}</option>
        {/each}
      </select>
    </label>

    {#if form.frequency === 'hourly'}
      <label class="field">
        <span>{t('schedules.fieldMinute')}</span>
        <input type="number" min="0" max="59" bind:value={form.minute} />
      </label>
    {/if}

    {#if showTime}
      <label class="field">
        <span>{t('schedules.fieldTime')}</span>
        <input type="time" value={timeValue} oninput={onTimeInput} />
      </label>
    {/if}

    {#if form.frequency === 'weekly'}
      <label class="field">
        <span>{t('schedules.fieldWeekday')}</span>
        <select bind:value={form.weekday}>
          {#each [0, 1, 2, 3, 4, 5, 6] as d (d)}
            <option value={d}>{t('schedules.weekday' + d)}</option>
          {/each}
        </select>
      </label>
    {/if}

    {#if form.frequency === 'custom'}
      <label class="field">
        <span>{t('schedules.fieldCron')}</span>
        <input
          type="text"
          data-testid="schedule-cron"
          bind:value={form.customCron}
          placeholder="0 9 * * 1-5"
        />
        <small class="muted">{t('schedules.cronHint')}</small>
      </label>
    {/if}

    {#if form.frequency !== 'manual'}
      <label class="field">
        <span>{t('schedules.fieldTimezone')}</span>
        <input type="text" bind:value={form.timezone} placeholder="UTC" />
      </label>
    {/if}

    <label class="field checkbox">
      <input type="checkbox" bind:checked={form.enabled} />
      <span>{t('schedules.fieldEnabled')}</span>
    </label>

    {#if formError}
      <p class="error" role="alert">{formError}</p>
    {/if}

    <div class="editor-actions">
      <button type="button" class="small-btn" data-testid="schedule-cancel" onclick={closeEditor}
        >{t('common.cancel')}</button
      >
      <button
        type="button"
        class="primary-btn"
        data-testid="schedule-save"
        onclick={save}
        disabled={saving}
      >
        {saving ? t('schedules.saving') : t('common.save')}
      </button>
    </div>
  </div>
{/if}

<style>
  .schedules-page {
    max-width: 880px;
    margin: 0 auto;
    padding: 24px 16px 64px;
  }
  .schedules-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }
  .schedules-header h1 {
    flex: 1;
    margin: 0;
    font-size: 1.4rem;
  }
  .schedule-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .schedule-card {
    border: 1px solid var(--border, rgba(127, 127, 127, 0.25));
    border-radius: 12px;
    padding: 14px 16px;
  }
  .schedule-card.disabled {
    opacity: 0.6;
  }
  .schedule-main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .schedule-name {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .schedule-meta {
    font-size: 0.85rem;
    margin-top: 4px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .schedule-path {
    font-size: 0.8rem;
    margin-top: 2px;
    font-family: var(--font-mono, monospace);
  }
  .schedule-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .badge {
    font-size: 0.7rem;
    border: 1px solid var(--border, rgba(127, 127, 127, 0.4));
    border-radius: 999px;
    padding: 1px 8px;
  }
  .run-log {
    margin-top: 12px;
    border-top: 1px solid var(--border, rgba(127, 127, 127, 0.2));
    padding-top: 10px;
  }
  .run-log ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .run-row {
    display: flex;
    gap: 12px;
    align-items: center;
    font-size: 0.85rem;
  }
  .run-time {
    min-width: 160px;
  }
  .muted {
    color: var(--muted, rgba(127, 127, 127, 0.9));
  }
  .error {
    color: var(--danger, #c0392b);
  }
  .editor-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 40;
  }
  .editor {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    background: var(--surface, #fff);
    color: inherit;
    border-radius: 14px;
    padding: 20px 22px;
    z-index: 41;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }
  .editor h2 {
    margin: 0 0 16px;
    font-size: 1.1rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
  }
  .field > span {
    font-size: 0.82rem;
    font-weight: 500;
  }
  .field input[type='text'],
  .field input[type='number'],
  .field input[type='time'],
  .field textarea,
  .field select {
    font: inherit;
    padding: 8px 10px;
    border: 1px solid var(--border, rgba(127, 127, 127, 0.3));
    border-radius: 8px;
    background: var(--input-bg, transparent);
    color: inherit;
  }
  .field.checkbox {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  .model-select {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .model-trigger {
    flex: 1;
    text-align: left;
    font: inherit;
    padding: 8px 10px;
    border: 1px solid var(--border, rgba(127, 127, 127, 0.3));
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .model-popup {
    margin-top: 6px;
    border: 1px solid var(--border, rgba(127, 127, 127, 0.3));
    border-radius: 8px;
    padding: 8px;
  }
  .model-search {
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 8px;
    font: inherit;
    padding: 6px 8px;
    border: 1px solid var(--border, rgba(127, 127, 127, 0.3));
    border-radius: 6px;
    background: transparent;
    color: inherit;
  }
  .model-list {
    max-height: 220px;
    overflow-y: auto;
  }
  .model-provider {
    font-size: 0.7rem;
    text-transform: uppercase;
    opacity: 0.6;
    margin: 6px 0 2px;
  }
  .model-item {
    display: block;
    width: 100%;
    text-align: left;
    font: inherit;
    padding: 6px 8px;
    border: none;
    background: transparent;
    color: inherit;
    border-radius: 6px;
    cursor: pointer;
  }
  .model-item:hover {
    background: var(--surface-hover, rgba(127, 127, 127, 0.12));
  }
  .editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }
  .primary-btn {
    font: inherit;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    background: var(--accent, #2563eb);
    color: #fff;
    cursor: pointer;
  }
  .primary-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .small-btn {
    font: inherit;
    font-size: 0.82rem;
    padding: 5px 10px;
    border-radius: 7px;
    border: 1px solid var(--border, rgba(127, 127, 127, 0.3));
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .small-btn:hover {
    background: var(--surface-hover, rgba(127, 127, 127, 0.12));
  }
  .small-btn.danger {
    color: var(--danger, #c0392b);
  }
  .link-btn {
    font: inherit;
    border: none;
    background: transparent;
    color: var(--accent, #2563eb);
    cursor: pointer;
    padding: 0;
  }
  .empty {
    text-align: center;
    padding: 48px 0;
  }
</style>
