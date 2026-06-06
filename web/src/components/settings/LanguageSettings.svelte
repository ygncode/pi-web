<script>
  import { availableLocales } from '../../shared/i18n.js';
  // Built-ins + any custom locales defined in the setting (read at load).
  const locales = availableLocales();
</script>

<section class="settings-section">
  <div class="settings-section-title">Language</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">Language</span>
      <span class="hint">Language for the app interface. Changing it reloads the page.</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-web:v1:locale" data-setting-locale>
        {#each locales as loc (loc.code)}
          <option value={loc.code}>{loc.label}</option>
        {/each}
      </select>
    </div>
  </div>
  <div class="settings-row settings-row-stacked">
    <div class="settings-row-label">
      <span class="name">Custom languages</span>
      <span class="hint">Add or override languages as JSON — an array of <code>{'{ "code", "label", "strings": { … } }'}</code>. Missing keys fall back to English. Use “Copy English keys” for a starting template, then “Save &amp; apply”.</span>
    </div>
    <div class="settings-control settings-control-stacked">
      <textarea data-custom-languages class="settings-custom-languages" rows="8" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="[]"></textarea>
      <div class="settings-custom-languages-actions">
        <button type="button" class="btn-secondary" data-copy-en-keys>Copy English keys</button>
        <button type="button" class="btn-primary" data-save-custom-languages>Save &amp; apply</button>
      </div>
      <div class="settings-custom-languages-status" data-custom-languages-status hidden></div>
    </div>
  </div>
</section>
