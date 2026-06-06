import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createAnnotationLayer } from './annotation-layer.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeApi(initial = []) {
  let store = [...initial];
  let seq = 0;
  return {
    list: vi.fn(async () => store.slice()),
    create: vi.fn(async (a) => {
      const saved = { ...a, id: `real-${++seq}`, source: 'local', createdAt: Date.now() };
      store.push(saved);
      return saved;
    }),
    remove: vi.fn(async (id) => { store = store.filter((x) => x.id !== id); return true; }),
    _store: () => store
  };
}

function setup({ api, selectionDelayMs = 250, onCreate = null, onSend = null, onAddToChat = null } = {}) {
  const dom = new JSDOM(
    '<div id="messages"><div id="entry-e1">hello world</div></div>'
    + '<div id="annotation-list-host"></div>'
    + '<textarea id="pi-chat-message"></textarea>'
    + '<span id="annotation-tab-count" hidden>0</span>'
  );
  const { document: doc, window: win } = dom.window;
  const layer = createAnnotationLayer({
    sessionId: 's1',
    api: api || fakeApi(),
    messagesEl: doc.getElementById('messages'),
    listHost: doc.getElementById('annotation-list-host'),
    composerEl: doc.getElementById('pi-chat-message'),
    countEl: doc.getElementById('annotation-tab-count'),
    escapeHtml,
    onCreate,
    onSend,
    onAddToChat,
    selectionDelayMs,
    documentImpl: doc,
    windowImpl: win
  });
  return { doc, win, layer };
}

function selectWorld(doc, win) {
  const t = doc.getElementById('entry-e1').firstChild;
  const range = doc.createRange();
  range.setStart(t, 6);
  range.setEnd(t, 11);
  const sel = win.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

describe('annotation layer', () => {
  it('renders empty state and a count of zero', () => {
    const { doc, layer } = setup();
    layer.setAnnotations([]);
    expect(doc.querySelector('.annotation-empty')).not.toBeNull();
    expect(doc.getElementById('annotation-tab-count').hidden).toBe(true);
  });

  it('renders notes, count, and highlights from a snapshot', () => {
    const { doc, layer } = setup();
    layer.setAnnotations([
      { id: 'a1', anchorId: 'entry-e1', startOffset: 0, endOffset: 5, text: 'note', original: 'hello' }
    ]);
    expect(doc.querySelectorAll('.annotation-item')).toHaveLength(1);
    expect(doc.querySelector('.annotation-note').textContent).toBe('note');
    expect(doc.getElementById('annotation-tab-count').textContent).toBe('1');
    expect(doc.querySelector('mark.pi-annotation[data-annotation-id="a1"]').textContent).toBe('hello');
  });

  it('creates a comment from a selection through the popover', async () => {
    const api = fakeApi();
    const { doc, win, layer } = setup({ api });
    layer.init();
    await tick(); // initial refresh

    selectWorld(doc, win);
    doc.dispatchEvent(new win.MouseEvent('mouseup'));

    const commentBtn = doc.querySelector('.annotation-popover [data-action="start-comment"]');
    expect(commentBtn).not.toBeNull();
    commentBtn.click();

    doc.querySelector('.annotation-note-input').value = 'fix this';
    doc.querySelector('[data-action="save-note"]').click();
    await tick();
    await tick();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      anchorId: 'entry-e1', startOffset: 6, endOffset: 11, kind: 'comment', text: 'fix this', original: 'world'
    }));
    expect(doc.querySelector('.annotation-note').textContent).toBe('fix this');
    expect(doc.querySelector('mark.pi-annotation').textContent).toBe('world');
  });

  it('hands a selection to the composer via onAddToChat without saving it', async () => {
    const api = fakeApi();
    const onAddToChat = vi.fn();
    const { doc, win, layer } = setup({ api, onAddToChat });
    layer.init();
    await tick();

    selectWorld(doc, win);
    doc.dispatchEvent(new win.MouseEvent('mouseup'));
    doc.querySelector('[data-action="start-comment"]').click();

    doc.querySelector('.annotation-note-input').value = 'use this snippet';
    doc.querySelector('[data-action="add-to-chat"]').click();
    await tick();

    expect(onAddToChat).toHaveBeenCalledWith({ original: 'world', note: 'use this snippet' });
    expect(api.create).not.toHaveBeenCalled();
    // Modal closes and nothing is added to the Notes list.
    expect(doc.querySelector('.annotation-note-modal').hidden).toBe(true);
    expect(doc.querySelector('.annotation-item')).toBeNull();
  });

  it('fires onCreate when a note is saved (to reveal the panel)', async () => {
    const onCreate = vi.fn();
    const { doc, win, layer } = setup({ onCreate });
    layer.init();
    await tick();

    selectWorld(doc, win);
    doc.dispatchEvent(new win.MouseEvent('mouseup'));
    doc.querySelector('[data-action="start-comment"]').click();
    doc.querySelector('.annotation-note-input').value = 'look here';
    doc.querySelector('[data-action="save-note"]').click();

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('shows the popover from selectionchange (touch, where mouseup never fires)', async () => {
    const { doc, win, layer } = setup({ selectionDelayMs: 0 });
    layer.init();
    await tick();

    // Note: no mouseup is dispatched here — only selectionchange, like mobile.
    selectWorld(doc, win);
    doc.dispatchEvent(new win.Event('selectionchange'));
    await new Promise((r) => win.setTimeout(r, 10)); // let the debounce fire on win's clock

    expect(doc.querySelector('.annotation-popover [data-action="start-comment"]')).not.toBeNull();
  });

  it('deletes a note on click', async () => {
    const api = fakeApi([{ id: 'a1', anchorId: 'entry-e1', startOffset: 0, endOffset: 5, text: 'n', original: 'hello' }]);
    const { doc, layer } = setup({ api });
    layer.init();
    await tick();
    expect(doc.querySelectorAll('.annotation-item')).toHaveLength(1);

    doc.querySelector('[data-action="delete"]').click();
    await tick();
    await tick();
    expect(api.remove).toHaveBeenCalledWith('a1');
    expect(doc.querySelector('.annotation-empty')).not.toBeNull();
  });

  it('fills the composer when sending transcript notes to pi', () => {
    const { doc, layer } = setup();
    layer.setAnnotations([
      { id: 'a1', anchorId: 'entry-e1', startOffset: 0, endOffset: 5, text: 'rename this', original: 'hello' }
    ]);
    doc.querySelector('[data-action="send-to-pi"]').click();
    const composer = doc.getElementById('pi-chat-message');
    expect(composer.value).toContain('continuation of our current task');
    expect(composer.value).toContain('In this conversation:');
    expect(composer.value).toContain('"hello"');
    expect(composer.value).toContain('rename this');
  });

  it('fires onSend before focusing the composer on send-to-pi', () => {
    const calls = [];
    const onSend = vi.fn(() => calls.push('onSend'));
    const { doc, layer } = setup({ onSend });
    const composer = doc.getElementById('pi-chat-message');
    composer.focus = vi.fn(() => calls.push('focus'));
    layer.setAnnotations([
      { id: 'a1', anchorId: 'entry-e1', startOffset: 0, endOffset: 5, text: 'note', original: 'hello' }
    ]);
    doc.querySelector('[data-action="send-to-pi"]').click();
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['onSend', 'focus']); // collapse the overlay, then focus
  });

  it('includes file path and line numbers for artifact notes', () => {
    const dom = new JSDOM(
      '<div id="messages"></div><div id="annotation-list-host"></div><textarea id="pi-chat-message"></textarea>'
    );
    const { document: doc, window: win } = dom.window;
    const content = 'line one\nline two\nline three\nline four\n';
    const resolveArtifact = (id) => (id === 'art-1'
      ? { id: 'art-1', filePath: '/Users/setkyar/milktea/the-silver-flute-of-bagan.md', content }
      : null);
    const layer = createAnnotationLayer({
      sessionId: 's1',
      api: fakeApi(),
      scopes: [doc.getElementById('messages')],
      listHost: doc.getElementById('annotation-list-host'),
      composerEl: doc.getElementById('pi-chat-message'),
      escapeHtml,
      resolveArtifact,
      documentImpl: doc,
      windowImpl: win
    });
    layer.setAnnotations([
      { id: 'n1', anchorId: 'artifact-art-1', startOffset: 0, endOffset: 4, text: 'add (burmese)', original: 'line' },
      { id: 'n2', anchorId: 'artifact-art-1', startOffset: 9, endOffset: 28, text: 'spans lines', original: 'two..three' }
    ]);
    doc.querySelector('[data-action="send-to-pi"]').click();
    const v = doc.getElementById('pi-chat-message').value;
    expect(v).toContain('In /Users/setkyar/milktea/the-silver-flute-of-bagan.md:');
    expect(v).toContain('Line 1 — "line"');
    expect(v).toContain('add (burmese)');
    expect(v).toContain('Lines 2-3 — "two..three"');
  });

  it('does not let a slow initial load clobber a newer optimistic create', async () => {
    // api.list resolves only when we release it, simulating a slow initial
    // refresh that completes after the user has already created an annotation.
    let releaseList;
    const slow = new Promise((r) => { releaseList = r; });
    const store = [];
    let firstList = true;
    const api = {
      list: vi.fn(() => {
        if (firstList) { firstList = false; return slow; } // stale initial load
        return Promise.resolve(store.slice());
      }),
      create: vi.fn(async (a) => { const s = { ...a, id: 'real-1' }; store.push(s); return s; }),
      remove: vi.fn()
    };
    const { doc, win, layer } = setup({ api });
    layer.init(); // kicks off the slow refresh

    selectWorld(doc, win);
    doc.dispatchEvent(new win.MouseEvent('mouseup'));
    doc.querySelector('[data-action="start-comment"]').click();
    doc.querySelector('.annotation-note-input').value = 'keep me';
    doc.querySelector('[data-action="save-note"]').click();
    await tick();

    // The stale initial list resolves with [] only now — it must be ignored.
    releaseList([]);
    await tick();
    await tick();

    expect(doc.querySelectorAll('.annotation-item')).toHaveLength(1);
    expect(doc.querySelector('.annotation-note').textContent).toBe('keep me');
  });

  it('annotates text inside an artifact scope', async () => {
    const dom = new JSDOM(
      '<div id="messages"></div>'
      + '<div id="artifact-panel-host"><pre id="artifact-art-1">package main</pre></div>'
      + '<div id="annotation-list-host"></div>'
      + '<span id="annotation-tab-count" hidden>0</span>'
    );
    const { document: doc, window: win } = dom.window;
    const api = fakeApi();
    const layer = createAnnotationLayer({
      sessionId: 's1',
      api,
      scopes: [doc.getElementById('messages'), doc.getElementById('artifact-panel-host')],
      listHost: doc.getElementById('annotation-list-host'),
      countEl: doc.getElementById('annotation-tab-count'),
      escapeHtml,
      documentImpl: doc,
      windowImpl: win
    });
    layer.init();
    await tick();

    const t = doc.getElementById('artifact-art-1').firstChild;
    const range = doc.createRange();
    range.setStart(t, 8); // "main"
    range.setEnd(t, 12);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    doc.dispatchEvent(new win.MouseEvent('mouseup'));

    doc.querySelector('[data-action="start-comment"]').click();
    doc.querySelector('.annotation-note-input').value = 'rename';
    doc.querySelector('[data-action="save-note"]').click();
    await tick();
    await tick();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ anchorId: 'artifact-art-1', original: 'main' }));
    expect(doc.querySelector('#artifact-art-1 mark.pi-annotation').textContent).toBe('main');
  });

  it('is a no-op when required hosts are missing', () => {
    const layer = createAnnotationLayer({ sessionId: 's1' });
    expect(() => { layer.init(); layer.setAnnotations([]); layer.reapply(); }).not.toThrow();
  });
});
