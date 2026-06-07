<script>
  import { t } from '../../shared/i18n.js';
  import { applyTheme } from '../../shared/theme.js';
  import { applyFonts } from '../../shared/fonts.js';
  import { valueFor } from '../../settings/settings-support.js';

  let { settings = {}, onSave = () => {}, onSaved = () => {} } = $props();
  const FONT_KEYS = { ui: 'pi-web:v1:font-ui', content: 'pi-web:v1:font-content', code: 'pi-web:v1:font-code' };
  const BUILTIN_FONTS = ['mono', 'system', 'sans', 'serif'];
  const uiSizeKey = 'pi-web:v1:font-ui-size';
  const contentSizeKey = 'pi-web:v1:font-content-size';
  let theme = $derived(valueFor(settings, 'pi-web-theme', 'dark'));
  let uiSize = $derived(valueFor(settings, uiSizeKey, '14'));
  let contentSize = $derived(valueFor(settings, contentSizeKey, '15'));
  let detectedFonts = $state([]);
  // User explicitly picked "Custom…" for a kind, so the text field shows even
  // before a family is committed (auto-detected custom families don't need it).
  let manualCustom = $state({ ui: false, content: false, code: false });
  // In-progress edit to the custom-family text (null = not editing; fall back to
  // the stored value). Kept separate from settings so typing isn't clobbered.
  let customDraft = $state({ ui: null, content: null, code: null });

  function fontValue(kind) { return valueFor(settings, FONT_KEYS[kind], 'mono'); }
  function isCustomFont(kind) {
    const v = fontValue(kind);
    return !BUILTIN_FONTS.includes(v) && !detectedFonts.includes(v);
  }
  // All pure (reads only) — safe to call from the template. The previous version
  // wrote $state inside fontSelectValue(), which throws state_unsafe_mutation when
  // this component mounts during a reactive route swap rather than a fresh load.
  function fontSelectValue(kind) {
    return isCustomFont(kind) ? '__custom__' : fontValue(kind);
  }
  function customShown(kind) {
    return manualCustom[kind] || isCustomFont(kind);
  }
  function customValue(kind) {
    if (customDraft[kind] != null) return customDraft[kind];
    return isCustomFont(kind) ? fontValue(kind) : '';
  }
  function setDraft(kind, value) {
    customDraft = { ...customDraft, [kind]: value };
  }

  function commitTheme(value) {
    applyTheme(window, document, value);
    onSaved();
  }

  function commitSize(kind, value) {
    const key = kind === 'ui' ? uiSizeKey : contentSizeKey;
    onSave(key, value);
    applyFonts(document, kind === 'ui' ? { uiSize: value } : { contentSize: value });
  }

  function commitFont(kind, value) {
    onSave(FONT_KEYS[kind], value);
    applyFonts(document, { [kind]: value });
  }

  async function detectInstalledFonts() {
    if (typeof window.queryLocalFonts !== 'function') {
      window.alert?.(t('settings.fontDetectUnsupported'));
      return;
    }
    try {
      const fonts = await window.queryLocalFonts();
      detectedFonts = Array.from(new Set(fonts.map((f) => f.family))).sort((a, b) => a.localeCompare(b));
      onSaved();
    } catch {
      window.alert?.(t('settings.fontDetectDenied'));
    }
  }

  async function handleFontSelect(kind, value) {
    if (value === '__detect__') { await detectInstalledFonts(); return; }
    if (value === '__custom__') {
      manualCustom = { ...manualCustom, [kind]: true };
      setDraft(kind, fontValue(kind));
      return;
    }
    manualCustom = { ...manualCustom, [kind]: false };
    setDraft(kind, null);
    commitFont(kind, value);
  }

  function commitCustom(kind) {
    const fam = String(customValue(kind)).trim();
    if (fam) {
      commitFont(kind, fam);
      setDraft(kind, null); // stored value is now the source of truth
    }
  }
</script>

<section class="settings-section">
  <div class="settings-section-title">{t('settings.appearance')}</div>
  <div class="settings-row">
    <div class="settings-row-label"><span class="name">{t('settings.theme')}</span><span class="hint">{t('settings.themeHint')}</span></div>
    <div class="settings-control"><select data-setting="pi-web-theme" data-setting-theme value={theme} onchange={(e) => commitTheme(e.currentTarget.value)}><option value="dark">{t('settings.themeDark')}</option><option value="light">{t('settings.themeLight')}</option><option value="nord">Nord</option><option value="dracula">Dracula</option><option value="custom">{t('settings.themeCustom')}</option></select></div>
  </div>

  {#each [{ kind: 'ui', name: t('settings.interfaceFont'), hint: t('settings.interfaceFontHint') }, { kind: 'content', name: t('settings.contentFont'), hint: t('settings.contentFontHint') }, { kind: 'code', name: t('settings.codeFont'), hint: t('settings.codeFontHint') }] as item (item.kind)}
    <div class="settings-row">
      <div class="settings-row-label"><span class="name">{item.name}</span><span class="hint">{item.hint}</span></div>
      <div class="settings-control settings-font-control">
        <select data-font-select={item.kind} value={fontSelectValue(item.kind)} onchange={(e) => handleFontSelect(item.kind, e.currentTarget.value)}>
          <optgroup label={t('settings.fontBuiltIn')}><option value="mono">{t('settings.fontMono')}</option><option value="system">{t('settings.fontSystem')}</option><option value="sans">{t('settings.fontSans')}</option><option value="serif">{t('settings.fontSerif')}</option></optgroup>
          {#if detectedFonts.length}<optgroup label={t('settings.fontInstalled')}>{#each detectedFonts as fam (fam)}<option value={fam}>{fam}</option>{/each}</optgroup>{/if}
          <optgroup label={t('settings.fontActions')}><option value="__detect__">{t('settings.fontDetect')}</option><option value="__custom__">{t('settings.fontCustomOption')}</option></optgroup>
        </select>
        <input type="text" class="settings-font-custom" data-font-custom={item.kind} placeholder={t('settings.fontFamilyPlaceholder')} hidden={!customShown(item.kind)} value={customValue(item.kind)} oninput={(e) => setDraft(item.kind, e.currentTarget.value)} onchange={() => commitCustom(item.kind)}>
      </div>
    </div>
    {#if item.kind === 'ui'}
      <div class="settings-row"><div class="settings-row-label"><span class="name">{t('settings.interfaceFontSize')}</span><span class="hint">{t('settings.interfaceFontSizeHint')}</span></div><div class="settings-control"><input type="number" min="8" max="32" data-setting={uiSizeKey} value={uiSize} onchange={(e) => commitSize('ui', e.currentTarget.value)}></div></div>
    {:else if item.kind === 'content'}
      <div class="settings-row"><div class="settings-row-label"><span class="name">{t('settings.contentFontSize')}</span><span class="hint">{t('settings.contentFontSizeHint')}</span></div><div class="settings-control"><input type="number" min="8" max="32" data-setting={contentSizeKey} value={contentSize} onchange={(e) => commitSize('content', e.currentTarget.value)}></div></div>
    {/if}
  {/each}
</section>
