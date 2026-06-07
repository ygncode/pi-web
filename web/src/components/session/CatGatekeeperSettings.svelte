<script>
  // Cat Gatekeeper settings sheet — Svelte port of the showCatSettings UI from
  // cat-gatekeeper/cat-settings.js. Reactive form over <FullScreenSheet>; the
  // pure storage helpers stay in cat-settings.js. Opened via the bindable `open`
  // prop; the cat-gatekeeper controller passes `controller` (live status) and
  // `onChange` through the window bridge in SessionPage.
  import FullScreenSheet from './FullScreenSheet.svelte';
  import { loadCatSettings, saveCatSettings, LIMITS } from '../../session/cat-gatekeeper/cat-settings.js';

  let { open = $bindable(false), controller = null, onChange = () => {} } = $props();

  const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
  let settings = $state(loadCatSettings({ storage }));
  let statusText = $state('');

  function update(partial) {
    settings = saveCatSettings(partial, { storage });
    onChange(settings);
  }

  function refreshStatus() {
    statusText = controller?.getStatusText?.() || '';
  }

  // Reload settings from storage each time the sheet opens, and poll the live
  // status once per second while open (cleaned up on close).
  $effect(() => {
    if (!open) return;
    settings = loadCatSettings({ storage });
    if (!controller) return;
    refreshStatus();
    const timer = setInterval(refreshStatus, 1000);
    return () => clearInterval(timer);
  });
</script>

<FullScreenSheet bind:open title="Cat Gatekeeper" showClose={false}>
  <div class="cat-settings">
    <label class="cat-settings-row">
      <div class="cat-settings-label">Enable Cat Gatekeeper<div class="cat-settings-hint">A cat appears when it is time to rest.</div></div>
      <input class="cat-settings-toggle" type="checkbox" checked={settings.enabled} onchange={(e) => update({ enabled: e.currentTarget.checked })}>
    </label>

    <label class="cat-settings-row">
      <div class="cat-settings-label">Focus time (minutes)<div class="cat-settings-hint">Uninterrupted work before the cat appears.</div></div>
      <input class="cat-settings-number" type="number" min={LIMITS.focusMin.min} max={LIMITS.focusMin.max} value={settings.focusMin} onchange={(e) => update({ focusMin: e.currentTarget.value })}>
    </label>

    <label class="cat-settings-row">
      <div class="cat-settings-label">Break time (minutes)<div class="cat-settings-hint">How long the cat keeps you away.</div></div>
      <input class="cat-settings-number" type="number" min={LIMITS.breakMin.min} max={LIMITS.breakMin.max} value={settings.breakMin} onchange={(e) => update({ breakMin: e.currentTarget.value })}>
    </label>

    <label class="cat-settings-row">
      <div class="cat-settings-label">Bedtime<div class="cat-settings-hint">When the cat says goodnight.</div></div>
      <input class="cat-settings-time" type="time" value={settings.bedtime} onchange={(e) => update({ bedtime: e.currentTarget.value })}>
    </label>

    <label class="cat-settings-row">
      <div class="cat-settings-label">Wakeup<div class="cat-settings-hint">When the cat lets you back in.</div></div>
      <input class="cat-settings-time" type="time" value={settings.wakeup} onchange={(e) => update({ wakeup: e.currentTarget.value })}>
    </label>

    <label class="cat-settings-row">
      <div class="cat-settings-label">Sleep reminder (minutes)<div class="cat-settings-hint">How long the sleepy cat stays before locking.</div></div>
      <input class="cat-settings-number" type="number" min={LIMITS.sleepMin.min} max={LIMITS.sleepMin.max} value={settings.sleepMin} onchange={(e) => update({ sleepMin: e.currentTarget.value })}>
    </label>

    {#if controller}
      <div class="cat-settings-status">
        <div class="cat-settings-status-text">{statusText}</div>
        <button type="button" class="cat-settings-skip" onclick={() => { controller.skipToBreak?.(); refreshStatus(); }}>Take a break now</button>
      </div>
    {/if}
  </div>
</FullScreenSheet>
