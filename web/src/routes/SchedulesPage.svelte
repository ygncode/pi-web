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
    icon,
    CalendarClock,
    ChevronLeft,
    Clock,
    ExternalLink,
    ListTree,
    Pause,
    Pencil,
    Play,
    Plus,
    Trash2,
    X,
  } from '../shared/icons.js';
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

<!-- eslint-disable svelte/no-at-html-tags -- trusted: Lucide icon SVG from icons.js -->

<div class="schedules-page">
  <header class="schedules-header">
    <button type="button" class="sched-back" onclick={() => navigate('/')}>
      <span class="sched-ico" aria-hidden="true">{@html icon(ChevronLeft, { size: 16 })}</span>
      <span>{t('schedules.backToSessions')}</span>
    </button>
    <h1 class="schedules-title">
      <span class="sched-ico" aria-hidden="true">{@html icon(CalendarClock, { size: 20 })}</span>
      {t('schedules.title')}
    </h1>
    <button
      type="button"
      class="sched-btn sched-btn-primary"
      data-testid="schedule-new"
      onclick={openCreate}
    >
      <span class="sched-ico" aria-hidden="true">{@html icon(Plus, { size: 15 })}</span>
      <span>{t('schedules.new')}</span>
    </button>
  </header>

  {#if loadError}
    <p class="sched-error" role="alert">{loadError}</p>
  {/if}

  {#if loading}
    <p class="sched-muted">{t('schedules.loading')}</p>
  {:else if schedules.length === 0}
    <div class="sched-empty">
      <span class="sched-empty-icon" aria-hidden="true"
        >{@html icon(CalendarClock, { size: 32 })}</span
      >
      <p class="sched-empty-title">{t('schedules.emptyTitle')}</p>
      <p class="sched-muted">{t('schedules.emptyHint')}</p>
      <button type="button" class="sched-btn sched-btn-primary" onclick={openCreate}>
        <span class="sched-ico" aria-hidden="true">{@html icon(Plus, { size: 15 })}</span>
        <span>{t('schedules.new')}</span>
      </button>
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
          <div class="schedule-card-head">
            <div class="schedule-title-row">
              <span class="schedule-name" data-testid="schedule-card-name">{schedule.name}</span>
              <span class="schedule-pill" data-state={schedule.enabled ? 'active' : 'paused'}>
                {schedule.enabled ? t('schedules.active') : t('schedules.paused')}
              </span>
            </div>
            <div class="schedule-meta">
              <span class="schedule-cadence">
                <span class="sched-ico" aria-hidden="true">{@html icon(Clock, { size: 13 })}</span>
                {freqLabel(schedule)}
              </span>
              {#if schedule.nextRunAt}
                <span class="schedule-tag"
                  >{t('schedules.next')}: {fmtTime(schedule.nextRunAt)}</span
                >
              {/if}
              {#if schedule.lastRunAt}
                <span class="schedule-tag"
                  >{t('schedules.last')}: {fmtTime(schedule.lastRunAt)}</span
                >
              {/if}
            </div>
            {#if schedule.projectPath}
              <div class="schedule-path">{schedule.projectPath}</div>
            {/if}
          </div>

          <div class="schedule-actions">
            <button
              type="button"
              class="sched-btn sched-btn-accent"
              data-testid="schedule-run"
              onclick={() => runNow(schedule)}
            >
              <span class="sched-ico" aria-hidden="true">{@html icon(Play, { size: 14 })}</span>
              <span>{t('schedules.runNow')}</span>
            </button>
            <button
              type="button"
              class="sched-btn"
              data-testid="schedule-toggle"
              onclick={() => toggleEnabled(schedule)}
            >
              <span class="sched-ico" aria-hidden="true"
                >{@html icon(schedule.enabled ? Pause : Play, { size: 14 })}</span
              >
              <span>{schedule.enabled ? t('schedules.pause') : t('schedules.resume')}</span>
            </button>
            <button
              type="button"
              class="sched-btn"
              data-testid="schedule-edit"
              onclick={() => openEdit(schedule)}
            >
              <span class="sched-ico" aria-hidden="true">{@html icon(Pencil, { size: 14 })}</span>
              <span>{t('schedules.edit')}</span>
            </button>
            <button
              type="button"
              class="sched-btn"
              class:active={expandedId === schedule.id}
              data-testid="schedule-runs"
              onclick={() => toggleRuns(schedule)}
            >
              <span class="sched-ico" aria-hidden="true">{@html icon(ListTree, { size: 14 })}</span>
              <span>{t('schedules.runs')}</span>
            </button>
            <button
              type="button"
              class="sched-btn sched-btn-danger"
              data-testid="schedule-delete"
              onclick={() => remove(schedule)}
            >
              <span class="sched-ico" aria-hidden="true">{@html icon(Trash2, { size: 14 })}</span>
              <span>{t('schedules.delete')}</span>
            </button>
          </div>

          {#if expandedId === schedule.id}
            <div class="run-log">
              {#if runsLoading}
                <p class="sched-muted">{t('schedules.loading')}</p>
              {:else if runs.length === 0}
                <p class="sched-muted">{t('schedules.noRuns')}</p>
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
                          class="sched-link"
                          data-testid="run-open"
                          onclick={() =>
                            navigate('/session?id=' + encodeURIComponent(run.sessionId))}
                        >
                          <span class="sched-ico" aria-hidden="true"
                            >{@html icon(ExternalLink, { size: 13 })}</span
                          >
                          {t('schedules.openSession')}
                        </button>
                      {:else}
                        <span class="sched-muted">{t('schedules.runStarted')}</span>
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
  <div class="schedule-editor-backdrop" role="presentation" onclick={closeEditor}></div>
  <div
    class="schedule-editor"
    role="dialog"
    aria-modal="true"
    aria-label={t('schedules.editorTitle')}
  >
    <div class="schedule-editor-head">
      <h2>{editingId ? t('schedules.editTitle') : t('schedules.new')}</h2>
      <button
        type="button"
        class="schedule-editor-close"
        aria-label={t('common.cancel')}
        onclick={closeEditor}>{@html icon(X, { size: 18 })}</button
      >
    </div>

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
          <button type="button" class="sched-btn" onclick={clearModel}
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
              <div class="sched-muted">{t('schedules.modelNone')}</div>
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

    <div class="field-row">
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
    </div>

    {#if form.frequency === 'custom'}
      <label class="field">
        <span>{t('schedules.fieldCron')}</span>
        <input
          type="text"
          data-testid="schedule-cron"
          bind:value={form.customCron}
          placeholder="0 9 * * 1-5"
        />
        <small class="sched-muted">{t('schedules.cronHint')}</small>
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
      <p class="sched-error" role="alert">{formError}</p>
    {/if}

    <div class="schedule-editor-actions">
      <button type="button" class="sched-btn" data-testid="schedule-cancel" onclick={closeEditor}
        >{t('common.cancel')}</button
      >
      <button
        type="button"
        class="sched-btn sched-btn-primary"
        data-testid="schedule-save"
        onclick={save}
        disabled={saving}
      >
        {saving ? t('schedules.saving') : t('common.save')}
      </button>
    </div>
  </div>
{/if}
