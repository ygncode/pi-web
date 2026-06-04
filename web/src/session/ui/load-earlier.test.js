import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupLoadEarlierBanner } from './load-earlier.js';

function dom() {
  return new JSDOM(`<body><div id="messages"></div></body>`);
}

function entry(i) {
  return { type: 'message', id: `id${String(i).padStart(6, '0')}`, message: { role: 'user', content: `m${i}` } };
}

describe('setupLoadEarlierBanner', () => {
  it('returns null when session is not truncated', () => {
    const jsdom = dom();
    const dataModel = { truncated: false, from: 0, total: 5, entries: [entry(0)] };
    const result = setupLoadEarlierBanner({
      dataModel,
      sessionId: 's.jsonl',
      syncDataModelEntries: vi.fn(),
      documentImpl: jsdom.window.document,
      fetchImpl: vi.fn(),
    });
    expect(result).toBeNull();
    expect(jsdom.window.document.getElementById('load-earlier-banner')).toBeNull();
  });

  it('returns null when from is 0 even if truncated flag is set', () => {
    const jsdom = dom();
    const dataModel = { truncated: true, from: 0, total: 5, entries: [entry(0)] };
    const result = setupLoadEarlierBanner({
      dataModel,
      sessionId: 's.jsonl',
      syncDataModelEntries: vi.fn(),
      documentImpl: jsdom.window.document,
      fetchImpl: vi.fn(),
    });
    expect(result).toBeNull();
  });

  it('renders banner with current state when truncated', () => {
    const jsdom = dom();
    const dataModel = {
      truncated: true,
      from: 1500,
      total: 2500,
      entries: Array.from({ length: 1000 }, (_, i) => entry(1500 + i)),
    };
    const result = setupLoadEarlierBanner({
      dataModel,
      sessionId: 's.jsonl',
      syncDataModelEntries: vi.fn(),
      documentImpl: jsdom.window.document,
      fetchImpl: vi.fn(),
      windowSize: 500,
    });
    expect(result).not.toBeNull();
    const banner = jsdom.window.document.getElementById('load-earlier-banner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('1,000');
    expect(banner.textContent).toContain('2,500');
    const button = banner.querySelector('.load-earlier-button');
    expect(button.textContent).toMatch(/Load 500 earlier/);
    expect(button.disabled).toBe(false);
  });

  it('fetches preceding window on click + merges via syncDataModelEntries', async () => {
    const jsdom = dom();
    const dataModel = {
      truncated: true,
      from: 100,
      total: 600,
      entries: Array.from({ length: 500 }, (_, i) => entry(100 + i)),
    };
    const olderEntries = Array.from({ length: 50 }, (_, i) => entry(50 + i));
    const syncMock = vi.fn();
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      json: async () => ({ entries: olderEntries, total: 600, from: 50 }),
    }));

    const banner = setupLoadEarlierBanner({
      dataModel,
      sessionId: 's.jsonl',
      syncDataModelEntries: syncMock,
      documentImpl: jsdom.window.document,
      fetchImpl: fetchMock,
      windowSize: 50,
    });

    await banner.loadEarlier();

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('from=50');
    expect(url).toContain('count=50');
    expect(syncMock).toHaveBeenCalledOnce();
    // Should have prepended olderEntries to the existing 500
    const mergedArg = syncMock.mock.calls[0][0];
    expect(mergedArg.length).toBe(550);
    expect(mergedArg[0].id).toBe('id000050');
    expect(dataModel.from).toBe(50);
  });

  it('removes the banner when all earlier entries are loaded', async () => {
    const jsdom = dom();
    const dataModel = {
      truncated: true,
      from: 30,
      total: 130,
      entries: Array.from({ length: 100 }, (_, i) => entry(30 + i)),
    };
    const earlierAll = Array.from({ length: 30 }, (_, i) => entry(i));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ entries: earlierAll, total: 130, from: 0 }),
    }));

    const banner = setupLoadEarlierBanner({
      dataModel,
      sessionId: 's.jsonl',
      syncDataModelEntries: vi.fn(),
      documentImpl: jsdom.window.document,
      fetchImpl: fetchMock,
      windowSize: 100,
    });

    await banner.loadEarlier();

    expect(dataModel.from).toBe(0);
    expect(dataModel.truncated).toBe(false);
    expect(jsdom.window.document.getElementById('load-earlier-banner')).toBeNull();
  });

  it('surfaces fetch errors + re-enables button', async () => {
    const jsdom = dom();
    const dataModel = {
      truncated: true,
      from: 100,
      total: 200,
      entries: Array.from({ length: 100 }, (_, i) => entry(100 + i)),
    };
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));

    const banner = setupLoadEarlierBanner({
      dataModel,
      sessionId: 's.jsonl',
      syncDataModelEntries: vi.fn(),
      documentImpl: jsdom.window.document,
      fetchImpl: fetchMock,
      windowSize: 50,
    });

    await banner.loadEarlier();

    const status = banner.banner.querySelector('.load-earlier-status');
    expect(status.textContent).toMatch(/Failed to load/);
    const button = banner.banner.querySelector('.load-earlier-button');
    expect(button.disabled).toBe(false);
  });
});
