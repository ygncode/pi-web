<script>
  import { t } from '../../shared/i18n.js';
  import { boolFor } from '../../settings/settings-support.js';
  import { TOGGLE_DEFAULT_SETTING_KEYS } from '../../session/ui/toggle-state.js';

  let { settings = {}, onSave = () => {} } = $props();

  const thinkingKey = TOGGLE_DEFAULT_SETTING_KEYS.thinkingExpanded;
  const toolsKey = TOGGLE_DEFAULT_SETTING_KEYS.toolsVisible;
  const toolOutputsKey = TOGGLE_DEFAULT_SETTING_KEYS.toolOutputsExpanded;

  let thinkingExpanded = $derived(boolFor(settings, thinkingKey, true));
  let toolsVisible = $derived(boolFor(settings, toolsKey, true));
  let toolOutputsExpanded = $derived(boolFor(settings, toolOutputsKey, false));

  function save(settingKey, checked) {
    onSave(settingKey, checked ? 'true' : 'false');
  }
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.sessionDisplay')}</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.thinkingExpanded')}</span><span class="hint"
        >{t('settings.thinkingExpandedHint')}</span
      >
    </div>
    <div class="settings-control">
      <label class="settings-toggle"
        ><input
          type="checkbox"
          data-setting={thinkingKey}
          checked={thinkingExpanded}
          onchange={(e) => save(thinkingKey, e.currentTarget.checked)}
        /><span class="slider"></span></label
      >
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.toolsVisible')}</span><span class="hint"
        >{t('settings.toolsVisibleHint')}</span
      >
    </div>
    <div class="settings-control">
      <label class="settings-toggle"
        ><input
          type="checkbox"
          data-setting={toolsKey}
          checked={toolsVisible}
          onchange={(e) => save(toolsKey, e.currentTarget.checked)}
        /><span class="slider"></span></label
      >
    </div>
  </div>
  <div class="settings-row" class:settings-row-disabled={!toolsVisible}>
    <div class="settings-row-label">
      <span class="name">{t('settings.toolOutputsExpanded')}</span><span class="hint"
        >{t('settings.toolOutputsExpandedHint')}</span
      >
    </div>
    <div class="settings-control">
      <label class="settings-toggle"
        ><input
          type="checkbox"
          data-setting={toolOutputsKey}
          checked={toolOutputsExpanded}
          disabled={!toolsVisible}
          onchange={(e) => save(toolOutputsKey, e.currentTarget.checked)}
        /><span class="slider"></span></label
      >
    </div>
  </div>
</section>
