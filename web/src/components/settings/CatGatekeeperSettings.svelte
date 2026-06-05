<section class="settings-section">
  <div class="settings-section-title">Cat Gatekeeper</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Enable Cat Gatekeeper</span>
      <span class="hint">A cat appears when it is time to rest.</span>
    </div>
    <div class="settings-control">
      <label class="settings-toggle">
        <input type="checkbox" data-setting="pi-web:v1:cat:enabled" data-setting-bool>
        <span class="slider"></span>
      </label>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Focus time (minutes)</span>
      <span class="hint">Uninterrupted work before the cat appears.</span>
    </div>
    <div class="settings-control">
      <input type="number" min="1" max="240" data-setting="pi-web:v1:cat:focus-min">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Break time (minutes)</span>
      <span class="hint">How long the cat keeps you away.</span>
    </div>
    <div class="settings-control">
      <input type="number" min="1" max="120" data-setting="pi-web:v1:cat:break-min">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Bedtime</span>
      <span class="hint">When the cat says goodnight.</span>
    </div>
    <div class="settings-control">
      <input type="time" data-setting="pi-web:v1:cat:bedtime">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Wakeup</span>
      <span class="hint">When the cat lets you back in.</span>
    </div>
    <div class="settings-control">
      <input type="time" data-setting="pi-web:v1:cat:wakeup">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Sleep reminder (minutes)</span>
      <span class="hint">How long the sleepy cat stays before locking.</span>
    </div>
    <div class="settings-control">
      <input type="number" min="1" max="60" data-setting="pi-web:v1:cat:sleep-min">
    </div>
  </div>
</section>
