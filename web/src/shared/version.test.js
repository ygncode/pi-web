import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderChangelog, createVersionController, openVersionModal } from './version.js';

describe('renderChangelog', () => {
  it('renders headings, bullets and inline code/bold/links safely', () => {
    const md = '## v1.2.3\n\n- Added `foo`\n- **Bold** thing\n- See [docs](https://example.com)';
    const html = renderChangelog(md);
    expect(html).toContain('<h4>v1.2.3</h4>');
    expect(html).toContain('<li>Added <code>foo</code></li>');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noreferrer">docs</a>');
  });

  it('escapes HTML to prevent injection', () => {
    const html = renderChangelog('- <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('rejects non-http link schemes', () => {
    const html = renderChangelog('[click](javascript:alert(1))');
    expect(html).not.toContain('href="javascript');
  });

  it('handles empty input', () => {
    expect(renderChangelog('')).toContain('No release notes');
  });
});

function setupDOM() {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <button data-version-row data-action="version"><span>pi-web</span><span class="version-status" data-version-status>…</span></button>
  </body>`);
  return dom;
}

function jsonResponse(body, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

describe('createVersionController', () => {
  let dom;
  beforeEach(() => { dom = setupDOM(); });

  it('populates the status label from /api/version', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ current: '1.0.0', latest: '1.1.0', hasUpdate: true }));
    createVersionController({ documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl });
    await Promise.resolve();
    await Promise.resolve();
    const status = dom.window.document.querySelector('[data-version-status]');
    expect(status.textContent).toBe('v1.0.0 → v1.1.0');
    expect(status.classList.contains('has-update')).toBe(true);
  });

  it('does not double the leading v when the version already has one', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ current: 'v2.3.4', hasUpdate: false }));
    createVersionController({ documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl });
    await Promise.resolve();
    await Promise.resolve();
    expect(dom.window.document.querySelector('[data-version-status]').textContent).toBe('v2.3.4');
  });

  it('shortens git-describe dev versions in the row', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ current: 'v0.0.1-beta.24-3-gd7e8bf2-dirty', isDev: true, hasUpdate: false }));
    createVersionController({ documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl });
    await Promise.resolve();
    await Promise.resolve();
    expect(dom.window.document.querySelector('[data-version-status]').textContent).toBe('v0.0.1-beta.24');
  });

  it('shows plain version when up to date', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ current: '1.0.0', latest: '1.0.0', hasUpdate: false }));
    createVersionController({ documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl });
    await Promise.resolve();
    await Promise.resolve();
    const status = dom.window.document.querySelector('[data-version-status]');
    expect(status.textContent).toBe('v1.0.0');
    expect(status.classList.contains('has-update')).toBe(false);
  });

  it('hides the Update button for dev builds but offers a check', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ current: 'v0.0.1-beta.24-3-gd7e8bf2-dirty', isDev: true, hasUpdate: false, latest: '0.0.1-beta.24' }));
    createVersionController({ documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl });
    await Promise.resolve();
    await Promise.resolve();
    openVersionModal();
    const overlay = dom.window.document.querySelector('.version-modal-overlay');
    const buttons = Array.from(overlay.querySelectorAll('.version-modal-btn')).map((b) => b.textContent);
    expect(buttons).toContain('Check for updates');
    expect(buttons).not.toContain('Update & Restart');
    expect(overlay.querySelector('.version-modal-body').textContent).toContain('local development build');
  });

  it('shows an inline loading state on the check button while a check is in flight', async () => {
    // First call (GET /api/version) resolves up-to-date; the manual check
    // (POST /api/check-update) stays pending so we can observe the in-flight UI.
    let resolveCheck;
    const fetchImpl = vi.fn((url) => {
      if (String(url).includes('check-update')) {
        return new Promise((resolve) => { resolveCheck = resolve; });
      }
      return jsonResponse({ current: '1.0.0', latest: '1.0.0', hasUpdate: false });
    });
    createVersionController({ documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl });
    await Promise.resolve();
    await Promise.resolve();
    openVersionModal();
    const overlay = dom.window.document.querySelector('.version-modal-overlay');
    const checkBtn = Array.from(overlay.querySelectorAll('.version-modal-btn'))
      .find((b) => b.textContent === 'Check for updates');
    expect(checkBtn).toBeTruthy();

    checkBtn.click();

    expect(checkBtn.classList.contains('is-loading')).toBe(true);
    expect(checkBtn.textContent).toBe('Checking…');
    expect(checkBtn.disabled).toBe(true);
    // The status row must stay hidden — no layout-jumping pop-in.
    expect(overlay.querySelector('.version-modal-status').hidden).toBe(true);

    resolveCheck({ ok: true, status: 200, json: () => Promise.resolve({ current: '1.0.0', latest: '1.0.0', hasUpdate: false }) });
  });

  it('openModal renders an update modal with an Update button', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ current: '1.0.0', latest: '1.1.0', hasUpdate: true, changelog: '- new' }));
    createVersionController({ documentImpl: dom.window.document, windowImpl: dom.window, fetchImpl });
    await Promise.resolve();
    await Promise.resolve();
    openVersionModal();
    const overlay = dom.window.document.querySelector('.version-modal-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.classList.contains('open')).toBe(true);
    const buttons = Array.from(overlay.querySelectorAll('.version-modal-btn')).map((b) => b.textContent);
    expect(buttons).toContain('Update & Restart');
  });
});
