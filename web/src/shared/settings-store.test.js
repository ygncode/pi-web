import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SERVER_SETTING_KEYS,
  configureSettingsSync,
  resetSettingsSyncForTests,
  writeSetting,
  writeSettings,
  hydrateSettings,
} from './settings-store.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

afterEach(() => {
  resetSettingsSyncForTests();
});

describe('writeSetting', () => {
  it('writes to localStorage without posting when sync is not configured', () => {
    const storage = fakeStorage();
    writeSetting('pi-web-theme', 'nord', { storage });
    expect(storage.getItem('pi-web-theme')).toBe('nord');
  });

  it('posts a server-backed key through to /api/settings when sync is configured', () => {
    const storage = fakeStorage();
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    configureSettingsSync({ fetchImpl });

    writeSetting('pi-web-theme', 'light', { storage });

    expect(storage.getItem('pi-web-theme')).toBe('light');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/settings');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ settings: { 'pi-web-theme': 'light' } });
  });

  it('does not post unknown (non-server-backed) keys', () => {
    const storage = fakeStorage();
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    configureSettingsSync({ fetchImpl });

    writeSetting('pi-web:v1:right-sidebar-width', '320', { storage });

    expect(storage.getItem('pi-web:v1:right-sidebar-width')).toBe('320');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('writeSettings', () => {
  it('batches server-backed keys into a single POST', () => {
    const storage = fakeStorage();
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    configureSettingsSync({ fetchImpl });

    writeSettings({ 'pi-web-theme': 'dracula', 'pi-sessions:spinner-style': 'braille' }, { storage });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      settings: { 'pi-web-theme': 'dracula', 'pi-sessions:spinner-style': 'braille' },
    });
  });
});

describe('hydrateSettings', () => {
  it('seeds localStorage from the server response', async () => {
    const storage = fakeStorage();
    const settings = {};
    for (const k of SERVER_SETTING_KEYS) settings[k] = 'x';
    settings['pi-web-theme'] = 'nord';
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ settings }) }));

    const result = await hydrateSettings({ fetchImpl, storage });

    expect(result['pi-web-theme']).toBe('nord');
    expect(storage.getItem('pi-web-theme')).toBe('nord');
    expect(storage.getItem('pi-sessions:spinner-style')).toBe('x');
  });

  it('returns null and leaves storage untouched on failure', async () => {
    const storage = fakeStorage();
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: false }));
    const result = await hydrateSettings({ fetchImpl, storage });
    expect(result).toBeNull();
    expect(storage._map.size).toBe(0);
  });

  it('no-ops without a fetch impl', async () => {
    const storage = fakeStorage();
    const result = await hydrateSettings({ fetchImpl: null, storage });
    expect(result).toBeNull();
  });
});
