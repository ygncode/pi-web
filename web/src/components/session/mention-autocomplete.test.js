import { describe, expect, it, vi } from 'vitest';
import {
  parseAtTrigger,
  renderFileList,
  setupMentionAutocomplete,
} from './ChatComposer.svelte';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const SAMPLE = [
  { path: 'src/app.js', isDir: false },
  { path: 'src/lib', isDir: true },
];

describe('parseAtTrigger', () => {
  it('triggers at the start of the message', () => {
    expect(parseAtTrigger('@', 1)).toEqual({ query: '', start: 0, end: 1 });
    expect(parseAtTrigger('@src', 4)).toEqual({ query: 'src', start: 0, end: 4 });
  });

  it('triggers after whitespace mid-message', () => {
    expect(parseAtTrigger('look at @src/app', 16)).toEqual({
      query: 'src/app',
      start: 8,
      end: 16,
    });
  });

  it('does not trigger inside an email (@ preceded by non-space)', () => {
    expect(parseAtTrigger('foo@bar', 7)).toBeNull();
  });

  it('closes once whitespace follows the token', () => {
    expect(parseAtTrigger('@src done', 9)).toBeNull();
  });

  it('returns null when there is no @ before the caret', () => {
    expect(parseAtTrigger('hello', 5)).toBeNull();
    expect(parseAtTrigger('', 0)).toBeNull();
  });

  it('uses the caret, not the full string, as the token end', () => {
    // Caret sits right after "@sr"; trailing "c/app" is ignored.
    expect(parseAtTrigger('@src/app', 3)).toEqual({ query: 'sr', start: 0, end: 3 });
  });
});

describe('renderFileList', () => {
  it('renders a loading state', () => {
    expect(renderFileList([], { loading: true })).toContain('Searching');
  });

  it('renders an empty state', () => {
    expect(renderFileList([])).toContain('No files match');
  });

  it('renders files and folders with a trailing slash for dirs', () => {
    const html = renderFileList(SAMPLE);
    expect(html).toContain('data-insert="src/app.js"');
    expect(html).toContain('data-isdir="1"');
    expect(html).toContain('src/lib/');
  });

  it('escapes paths', () => {
    const html = renderFileList([{ path: '<x>', isDir: false }], {
      escapeHtml: (s) => String(s).replace('<', '&lt;'),
    });
    expect(html).toContain('&lt;x>');
  });
});

function createDom() {
  const div = document.createElement('div');
  div.innerHTML = `
    <textarea id="pi-chat-message"></textarea>
    <div id="pi-chat-mention-popup" style="display:none">
      <div id="pi-chat-mention-list"></div>
    </div>
  `;
  document.body.appendChild(div);
  return div;
}

function type(textarea, value, caret = value.length) {
  textarea.value = value;
  textarea.selectionStart = caret;
  textarea.selectionEnd = caret;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('setupMentionAutocomplete controller', () => {
  function setup(files = SAMPLE) {
    const el = createDom();
    const getFiles = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ files }) }),
    );
    // Run the debounced fetch synchronously so tests can await a single flush.
    const api = setupMentionAutocomplete({
      documentImpl: document,
      windowImpl: window,
      sessionId: 's',
      chatApi: { getFiles },
      debounceMs: 0,
      setTimeoutImpl: (fn) => setTimeout(fn, 0),
      clearTimeoutImpl: (id) => clearTimeout(id),
    });
    return {
      el,
      api,
      getFiles,
      textarea: document.getElementById('pi-chat-message'),
      popup: document.getElementById('pi-chat-mention-popup'),
    };
  }

  it('opens and fetches files when @ is typed', async () => {
    const { el, getFiles, textarea, popup } = setup();
    type(textarea, '@');
    expect(popup.style.display).toBe('block');
    await flush();
    expect(getFiles).toHaveBeenCalled();
    expect(getFiles.mock.calls[0][0]).toBe('s');
    expect(getFiles.mock.calls[0][1]).toBe('');
    expect(document.querySelectorAll('.slash-item')).toHaveLength(2);
    el.remove();
  });

  it('passes the typed query to the API', async () => {
    const { el, getFiles, textarea } = setup();
    type(textarea, '@app');
    await flush();
    expect(getFiles.mock.calls.at(-1)[1]).toBe('app');
    el.remove();
  });

  it('inserts a file path with a trailing space and closes', async () => {
    const { el, api, textarea, popup } = setup();
    type(textarea, '@app');
    await flush();
    // First item is src/app.js (a file).
    const consumed = api.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(consumed).toBe(true);
    expect(textarea.value).toBe('src/app.js ');
    expect(popup.style.display).toBe('none');
    el.remove();
  });

  it('keeps the @ and popup open when a directory is selected', async () => {
    const { el, textarea, popup } = setup([{ path: 'src/lib', isDir: true }]);
    type(textarea, '@lib');
    await flush();
    document.querySelector('.slash-item').click();
    expect(textarea.value).toBe('@src/lib/');
    // The dispatched input event re-opens a scoped query, popup stays visible.
    expect(popup.style.display).toBe('block');
    el.remove();
  });

  it('navigates with arrow keys', async () => {
    const { el, api, textarea } = setup();
    type(textarea, '@');
    await flush();
    expect(api.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(true);
    expect(document.querySelectorAll('.slash-item')[1].classList.contains('active')).toBe(true);
    el.remove();
  });

  it('closes on Escape and when the token is abandoned', async () => {
    const { el, api, textarea, popup } = setup();
    type(textarea, '@');
    await flush();
    expect(api.handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(true);
    expect(popup.style.display).toBe('none');

    type(textarea, '@x');
    await flush();
    expect(popup.style.display).toBe('block');
    type(textarea, 'plain text');
    expect(popup.style.display).toBe('none');
    el.remove();
  });

  it('ignores keys when the popup is closed', () => {
    const { el, api } = setup();
    expect(api.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
    el.remove();
  });
});
