<script>
  import { t } from '../../shared/i18n.js';
  import { boolFor, valueFor } from '../../settings/settings-support.js';

  let { settings = {}, onSave = () => {} } = $props();
  const keys = {
    enabled: 'pi-web:v1:cat:enabled', focus: 'pi-web:v1:cat:focus-min', break: 'pi-web:v1:cat:break-min',
    bedtime: 'pi-web:v1:cat:bedtime', wakeup: 'pi-web:v1:cat:wakeup', sleep: 'pi-web:v1:cat:sleep-min',
  };
  let enabled = $derived(boolFor(settings, keys.enabled, false));
  let focus = $derived(valueFor(settings, keys.focus, '25'));
  let breakMin = $derived(valueFor(settings, keys.break, '5'));
  let bedtime = $derived(valueFor(settings, keys.bedtime, ''));
  let wakeup = $derived(valueFor(settings, keys.wakeup, ''));
  let sleep = $derived(valueFor(settings, keys.sleep, '10'));
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.catGatekeeper')}</div>
  <div class="settings-row"><div class="settings-row-label"><span class="name">{t('settings.catEnable')}</span><span class="hint">{t('settings.catEnableHint')}</span></div><div class="settings-control"><label class="settings-toggle"><input type="checkbox" data-setting={keys.enabled} checked={enabled} onchange={(e) => onSave(keys.enabled, e.currentTarget.checked ? 'true' : 'false')}><span class="slider"></span></label></div></div>
  <div class="settings-row"><div class="settings-row-label"><span class="name">{t('settings.catFocus')}</span><span class="hint">{t('settings.catFocusHint')}</span></div><div class="settings-control"><input type="number" min="1" max="240" data-setting={keys.focus} value={focus} onchange={(e) => onSave(keys.focus, e.currentTarget.value)}></div></div>
  <div class="settings-row"><div class="settings-row-label"><span class="name">{t('settings.catBreak')}</span><span class="hint">{t('settings.catBreakHint')}</span></div><div class="settings-control"><input type="number" min="1" max="120" data-setting={keys.break} value={breakMin} onchange={(e) => onSave(keys.break, e.currentTarget.value)}></div></div>
  <div class="settings-row"><div class="settings-row-label"><span class="name">{t('settings.catBedtime')}</span><span class="hint">{t('settings.catBedtimeHint')}</span></div><div class="settings-control"><input type="time" data-setting={keys.bedtime} value={bedtime} onchange={(e) => onSave(keys.bedtime, e.currentTarget.value)}></div></div>
  <div class="settings-row"><div class="settings-row-label"><span class="name">{t('settings.catWakeup')}</span><span class="hint">{t('settings.catWakeupHint')}</span></div><div class="settings-control"><input type="time" data-setting={keys.wakeup} value={wakeup} onchange={(e) => onSave(keys.wakeup, e.currentTarget.value)}></div></div>
  <div class="settings-row"><div class="settings-row-label"><span class="name">{t('settings.catSleep')}</span><span class="hint">{t('settings.catSleepHint')}</span></div><div class="settings-control"><input type="number" min="1" max="60" data-setting={keys.sleep} value={sleep} onchange={(e) => onSave(keys.sleep, e.currentTarget.value)}></div></div>
</section>
