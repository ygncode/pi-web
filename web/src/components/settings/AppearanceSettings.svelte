<script>
  import { t } from '../../shared/i18n.js';
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.appearance')}</div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.theme')}</span>
      <span class="hint">{t('settings.themeHint')}</span>
    </div>
    <div class="settings-control">
      <select data-setting="pi-web-theme" data-setting-theme>
        <option value="dark">{t('settings.themeDark')}</option>
        <option value="light">{t('settings.themeLight')}</option>
        <option value="nord">Nord</option>
        <option value="dracula">Dracula</option>
        <option value="custom">{t('settings.themeCustom')}</option>
      </select>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.interfaceFont')}</span>
      <span class="hint">{t('settings.interfaceFontHint')}</span>
    </div>
    <div class="settings-control settings-font-control">
      <select data-font-select="ui">
        <optgroup label={t('settings.fontBuiltIn')}>
          <option value="mono">{t('settings.fontMono')}</option>
          <option value="system">{t('settings.fontSystem')}</option>
          <option value="sans">{t('settings.fontSans')}</option>
          <option value="serif">{t('settings.fontSerif')}</option>
        </optgroup>
        <optgroup label={t('settings.fontActions')}>
          <option value="__detect__">{t('settings.fontDetect')}</option>
          <option value="__custom__">{t('settings.fontCustomOption')}</option>
        </optgroup>
      </select>
      <input type="text" class="settings-font-custom" data-font-custom="ui" placeholder={t('settings.fontFamilyPlaceholder')} hidden>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.interfaceFontSize')}</span>
      <span class="hint">{t('settings.interfaceFontSizeHint')}</span>
    </div>
    <div class="settings-control">
      <input type="number" min="8" max="32" data-setting="pi-web:v1:font-ui-size" data-setting-size="ui">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.contentFont')}</span>
      <span class="hint">{t('settings.contentFontHint')}</span>
    </div>
    <div class="settings-control settings-font-control">
      <select data-font-select="content">
        <optgroup label={t('settings.fontBuiltIn')}>
          <option value="mono">{t('settings.fontMono')}</option>
          <option value="system">{t('settings.fontSystem')}</option>
          <option value="sans">{t('settings.fontSans')}</option>
          <option value="serif">{t('settings.fontSerif')}</option>
        </optgroup>
        <optgroup label={t('settings.fontActions')}>
          <option value="__detect__">{t('settings.fontDetect')}</option>
          <option value="__custom__">{t('settings.fontCustomOption')}</option>
        </optgroup>
      </select>
      <input type="text" class="settings-font-custom" data-font-custom="content" placeholder={t('settings.fontFamilyPlaceholder')} hidden>
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.contentFontSize')}</span>
      <span class="hint">{t('settings.contentFontSizeHint')}</span>
    </div>
    <div class="settings-control">
      <input type="number" min="8" max="32" data-setting="pi-web:v1:font-content-size" data-setting-size="content">
    </div>
  </div>
  <div class="settings-row">
    <div class="settings-row-label">
      <span class="name">{t('settings.codeFont')}</span>
      <span class="hint">{t('settings.codeFontHint')}</span>
    </div>
    <div class="settings-control settings-font-control">
      <select data-font-select="code">
        <optgroup label={t('settings.fontBuiltIn')}>
          <option value="mono">{t('settings.fontMono')}</option>
          <option value="system">{t('settings.fontSystem')}</option>
          <option value="sans">{t('settings.fontSans')}</option>
          <option value="serif">{t('settings.fontSerif')}</option>
        </optgroup>
        <optgroup label={t('settings.fontActions')}>
          <option value="__detect__">{t('settings.fontDetect')}</option>
          <option value="__custom__">{t('settings.fontCustomOption')}</option>
        </optgroup>
      </select>
      <input type="text" class="settings-font-custom" data-font-custom="code" placeholder={t('settings.fontFamilyPlaceholder')} hidden>
    </div>
  </div>
</section>
