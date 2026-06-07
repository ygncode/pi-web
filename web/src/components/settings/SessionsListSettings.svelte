<script>
  import { t } from '../../shared/i18n.js';
  import { boolFor, valueFor } from '../../settings/settings-support.js';

  let { settings = {}, onSave = () => {} } = $props();
  const spinnerKey = 'pi-sessions:spinner-style';
  const layoutKey = 'pi-sessions:view-layout';
  const btwKey = 'pi-web:v1:show-btw-in-index';
  let spinner = $derived(valueFor(settings, spinnerKey, 'runcat'));
  let layout = $derived(valueFor(settings, layoutKey, 'timeline'));
  let showBtw = $derived(boolFor(settings, btwKey, false));
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.sessionsList')}</div>
  <div class="settings-row">
    <div class="settings-row-label"><span class="name">{t('settings.spinnerStyle')}</span><span class="hint">{t('settings.spinnerStyleHint')}</span></div>
    <div class="settings-control">
      <select data-setting={spinnerKey} value={spinner} onchange={(e) => onSave(spinnerKey, e.currentTarget.value)}>
        <option value="runcat">Runcat</option><option value="braille">Braille</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label"><span class="name">{t('settings.defaultLayout')}</span><span class="hint">{t('settings.defaultLayoutHint')}</span></div>
    <div class="settings-control">
      <select data-setting={layoutKey} value={layout} onchange={(e) => onSave(layoutKey, e.currentTarget.value)}>
        <option value="timeline">{t('index.layoutTimeline')}</option><option value="projects">{t('index.layoutProjects')}</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label"><span class="name">{t('settings.showBtw')}</span><span class="hint">{t('settings.showBtwHint')}</span></div>
    <div class="settings-control">
      <label class="settings-toggle"><input type="checkbox" data-setting={btwKey} checked={showBtw} onchange={(e) => onSave(btwKey, e.currentTarget.checked ? 'true' : 'false')}><span class="slider"></span></label>
    </div>
  </div>
</section>
