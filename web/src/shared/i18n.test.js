import { afterEach, describe, expect, it } from 'vitest';
import {
  t,
  getLocale,
  availableLocales,
  registerCustomLocales,
  readCustomLanguages,
  englishTemplate,
  resetI18n,
  LOCALE_KEY,
  CUSTOM_LANGUAGES_KEY,
} from './i18n.js';

afterEach(() => {
  localStorage.clear();
  resetI18n();
});

describe('i18n', () => {
  it('translates a known key and falls back to the key for unknown ones', () => {
    expect(t('settings.title')).toBe('Settings');
    expect(t('nope.missing')).toBe('nope.missing');
  });

  it('interpolates params', () => {
    expect(t('index.sessionsCount', { count: 7 })).toBe('7 sessions');
  });

  it('defaults to English and ignores an unknown stored locale', () => {
    expect(getLocale()).toBe('en');
    localStorage.setItem(LOCALE_KEY, 'xx');
    resetI18n();
    expect(getLocale()).toBe('en');
  });

  it('uses a built-in locale when selected', () => {
    localStorage.setItem(LOCALE_KEY, 'es');
    resetI18n();
    expect(t('settings.title')).toBe('Ajustes');
    expect(t('composer.send')).toBe('Enviar');
  });

  it('registers and uses a custom locale from the setting', () => {
    localStorage.setItem(
      CUSTOM_LANGUAGES_KEY,
      JSON.stringify([{ code: 'pt', label: 'Português', strings: { 'settings.title': 'Definições' } }]),
    );
    localStorage.setItem(LOCALE_KEY, 'pt');
    resetI18n();
    expect(t('settings.title')).toBe('Definições');
    // missing custom key falls back to English
    expect(t('composer.send')).toBe('Send');
    expect(availableLocales().map((l) => l.code)).toContain('pt');
  });

  it('parses custom languages and exposes the English template', () => {
    localStorage.setItem(CUSTOM_LANGUAGES_KEY, '[{"code":"pt"}]');
    expect(readCustomLanguages()).toEqual([{ code: 'pt' }]);
    expect(englishTemplate()['settings.title']).toBe('Settings');
  });
});
