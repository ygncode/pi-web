<script>
  import { onMount } from 'svelte';
  import { t } from '../../shared/i18n.js';
  import { boolFor, valueFor } from '../../settings/settings-support.js';
  import {
    fetchAvailableSounds,
    getSelectedSound,
    playDoneSound,
    setDoneNotifyEnabled,
    requestNotifyPermission,
    registerPushSubscription,
    unregisterPushSubscription,
  } from '../../session/chat/done-notifier.js';

  let { settings = {}, onSave = () => {}, onSaved = () => {} } = $props();
  const notifyKey = 'pi-share:v1:notify-on-done';
  const soundKey = 'pi-share:v1:done-sound';
  let notify = $derived(boolFor(settings, notifyKey, false));
  let sound = $derived(valueFor(settings, soundKey, getSelectedSound({ storage: globalThis.localStorage })));
  let sounds = $state(['cat.mp3', 'done.mp3']);

  onMount(async () => {
    const data = await fetchAvailableSounds({ fetchImpl: window.fetch.bind(window) });
    sounds = data.sounds || sounds;
  });

  async function handleNotifyToggle(checked) {
    if (!checked) {
      setDoneNotifyEnabled(false, { storage: localStorage });
      await unregisterPushSubscription({ windowImpl: window, fetchImpl: window.fetch.bind(window) });
      onSave(notifyKey, 'false');
      return;
    }
    const permission = await requestNotifyPermission({ windowImpl: window });
    const granted = permission === 'granted';
    setDoneNotifyEnabled(granted, { storage: localStorage });
    if (granted) await registerPushSubscription({ windowImpl: window, fetchImpl: window.fetch.bind(window) });
    onSave(notifyKey, granted ? 'true' : 'false');
  }

  function handleSound(value) {
    onSave(soundKey, value);
    playDoneSound({ windowImpl: window, storage: localStorage });
    onSaved();
  }
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.notifications')}</div>
  <div class="settings-row">
    <div class="settings-row-label"><span class="name">{t('settings.notifyReady')}</span><span class="hint">{t('settings.notifyReadyHint')}</span></div>
    <div class="settings-control"><label class="settings-toggle"><input type="checkbox" data-setting={notifyKey} checked={notify} onchange={(e) => handleNotifyToggle(e.currentTarget.checked)}><span class="slider"></span></label></div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label"><span class="name">{t('settings.doneSound')}</span><span class="hint">{t('settings.doneSoundHint')}</span></div>
    <div class="settings-control"><select data-setting={soundKey} data-setting-sound value={sound} onchange={(e) => handleSound(e.currentTarget.value)}>{#each sounds as name}<option value={name}>{name}</option>{/each}</select></div>
  </div>
</section>
