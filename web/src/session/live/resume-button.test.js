import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupResumeButton, showResumeCopiedNotice } from './resume-button.js';

describe('resume button', () => {
  it('shows copied notice', () => {
    const dom = new JSDOM('<body></body>');
    const state = {};
    showResumeCopiedNotice('pi --session abc', state, { documentImpl: dom.window.document, setTimeoutImpl: (cb) => cb(), clearTimeoutImpl: () => {} });
    const notice = dom.window.document.getElementById('resume-copy-notice');
    expect(notice.textContent).toBe('Copied');
    expect(notice.title).toBe('pi --session abc');
    expect(notice.style.opacity).toBe('0');
  });

  it('copies resume command on click', async () => {
    const dom = new JSDOM('<body data-session-uuid="abc"><button id="resume-btn"></button></body>');
    const navigatorImpl = { clipboard: { writeText: vi.fn(() => Promise.resolve()) } };
    setupResumeButton({ documentImpl: dom.window.document, navigatorImpl, state: {}, setTimeoutImpl: () => {}, clearTimeoutImpl: () => {} });
    dom.window.document.getElementById('resume-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(navigatorImpl.clipboard.writeText).toHaveBeenCalledWith('pi --session abc');
  });
});
