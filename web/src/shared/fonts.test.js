import { describe, expect, it } from 'vitest';
import {
  FONT_KEYWORDS,
  resolveFontStack,
  sanitizeFontFamily,
  clampSize,
  applyFonts,
} from './fonts.js';

describe('resolveFontStack', () => {
  it('resolves known keywords to their stacks', () => {
    expect(resolveFontStack('serif')).toBe(FONT_KEYWORDS.serif);
    expect(resolveFontStack('system')).toBe(FONT_KEYWORDS.system);
  });

  it('quotes a raw family name and appends the mono fallback', () => {
    expect(resolveFontStack('Fira Code')).toBe(`'Fira Code', ${FONT_KEYWORDS.mono}`);
  });

  it('falls back to mono for empty/garbage values', () => {
    expect(resolveFontStack('')).toBe(FONT_KEYWORDS.mono);
    expect(resolveFontStack('<<<>>>')).toBe(FONT_KEYWORDS.mono);
  });
});

describe('sanitizeFontFamily', () => {
  it('strips unsafe characters but keeps letters, digits, spaces, hyphens', () => {
    expect(sanitizeFontFamily('JetBrains Mono')).toBe('JetBrains Mono');
    expect(sanitizeFontFamily('Comic Sans <>{};"')).toBe('Comic Sans');
    expect(sanitizeFontFamily('SF-Pro 3')).toBe('SF-Pro 3');
  });
});

describe('clampSize', () => {
  it('clamps to the 8..32 range and rounds', () => {
    expect(clampSize(4)).toBe(8);
    expect(clampSize(99)).toBe(32);
    expect(clampSize('13')).toBe(13);
    expect(clampSize('abc', 12)).toBe(12);
  });
});

describe('applyFonts', () => {
  function fakeDoc() {
    const props = {};
    return {
      _props: props,
      documentElement: { style: { setProperty: (n, v) => { props[n] = v; } } },
    };
  }

  it('sets font-family and size custom properties', () => {
    const doc = fakeDoc();
    applyFonts(doc, { ui: 'serif', uiSize: '16' });
    expect(doc._props['--font-sans']).toBe(FONT_KEYWORDS.serif);
    expect(doc._props['--font-size-ui']).toBe('16px');
    expect(doc._props['--font-content']).toBeUndefined();
  });

  it('sets the code font custom property independently', () => {
    const doc = fakeDoc();
    applyFonts(doc, { code: 'Fira Code' });
    expect(doc._props['--font-code']).toBe(`'Fira Code', ${FONT_KEYWORDS.mono}`);
    expect(doc._props['--font-sans']).toBeUndefined();
    expect(doc._props['--font-content']).toBeUndefined();
  });

  it('clamps sizes when applied', () => {
    const doc = fakeDoc();
    applyFonts(doc, { contentSize: '999' });
    expect(doc._props['--font-content-size']).toBe('32px');
  });

  it('no-ops without a usable document', () => {
    expect(() => applyFonts(null, { ui: 'serif' })).not.toThrow();
    expect(() => applyFonts({}, { ui: 'serif' })).not.toThrow();
  });
});
