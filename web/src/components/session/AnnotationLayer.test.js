import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup } from '@testing-library/svelte';
import AnnotationLayer from './AnnotationLayer.svelte';
import { sessionRuntime, resetSessionRuntime } from '../../session/session-runtime.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const waitFor = async (fn, { timeout = 1000, interval = 5 } = {}) => {
  const start = Date.now();
  for (;;) {
    const result = fn();
    if (result) return result;
    if (Date.now() - start >= timeout) throw new Error('waitFor: condition not met within timeout');
    await new Promise((r) => setTimeout(r, interval));
  }
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  resetSessionRuntime();
  vi.restoreAllMocks();
});

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
    _store: () => store,
  };
}

// Builds the standard transcript + composer + count badge scopes, renders the
// component, and returns the window-bridge layer plus the created hosts.
function setup({ api, selectionDelayMs = 250, onCreate = null, onSend = null, onAddToChat = null, init = true } = {}) {
  const messages = document.createElement('div');
  messages.id = 'messages';
  messages.innerHTML = '<div id="entry-e1">hello world</div>';
  document.body.appendChild(messages);
  const composer = document.createElement('textarea');
  composer.id = 'pi-chat-message';
  document.body.appendChild(composer);
  const count = document.createElement('span');
  count.id = 'annotation-tab-count';
  count.hidden = true;
  document.body.appendChild(count);

  render(AnnotationLayer);
  const layer = sessionRuntime.annotations;
  const resolvedApi = api || fakeApi();
  if (init) {
    layer.init({ api: resolvedApi, scopes: [messages], composerEl: composer, countEl: count, onCreate, onSend, onAddToChat, selectionDelayMs });
  }
  return { layer, messages, composer, count, api: resolvedApi };
}

function selectWorld() {
  const node = document.getElementById('entry-e1').firstChild;
  const range = document.createRange();
  range.setStart(node, 6);
  range.setEnd(node, 11);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

describe('AnnotationLayer', () => {
  it('renders empty state and a count of zero', async () => {
    const { layer, count } = setup();
    layer.setAnnotations([]);
    await tick();
    expect(document.querySelector('.annotation-empty')).not.toBeNull();
    expect(count.hidden).toBe(true);
  });

  it('renders notes, count, and highlights from a snapshot', async () => {
    const { layer, messages, count } = setup();
    layer.setAnnotations([
      { id: 'a1', anchorId: 'entry-e1', startOffset: 0, endOffset: 5, text: 'note', original: 'hello' },
    ]);
    await tick();
    expect(document.querySelectorAll('.annotation-item')).toHaveLength(1);
    expect(document.querySelector('.annotation-note').textContent).toBe('note');
    expect(count.textContent).toBe('1');
    expect(messages.querySelector('mark.pi-annotation[data-annotation-id="a1"]').textContent).toBe('hello');
  });

  it('creates a comment from a selection through the popover', async () => {
    const api = fakeApi();
    const { } = setup({ api });
    await flush(); // initial refresh

    selectWorld();
    document.dispatchEvent(new MouseEvent('mouseup'));

    const commentBtn = document.querySelector('.annotation-popover [data-action="start-comment"]');
    expect(commentBtn).not.toBeNull();
    commentBtn.click();

    document.querySelector('.annotation-note-input').value = 'fix this';
    document.querySelector('[data-action="save-note"]').click();
    await flush();
    await flush();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      anchorId: 'entry-e1', startOffset: 6, endOffset: 11, kind: 'comment', text: 'fix this', original: 'world',
    }));
    expect(document.querySelector('.annotation-note').textContent).toBe('fix this');
    expect(document.querySelector('mark.pi-annotation').textContent).toBe('world');
  });

  it('hands a selection to the composer via onAddToChat without saving it', async () => {
    const api = fakeApi();
    const onAddToChat = vi.fn();
    setup({ api, onAddToChat });
    await flush();

    selectWorld();
    document.dispatchEvent(new MouseEvent('mouseup'));
    document.querySelector('[data-action="start-comment"]').click();

    document.querySelector('.annotation-note-input').value = 'use this snippet';
    document.querySelector('[data-action="add-to-chat"]').click();
    await flush();

    expect(onAddToChat).toHaveBeenCalledWith({ original: 'world', note: 'use this snippet' });
    expect(api.create).not.toHaveBeenCalled();
    expect(document.querySelector('.annotation-note-modal').hidden).toBe(true);
    expect(document.querySelector('.annotation-item')).toBeNull();
  });

  it('fires onCreate when a note is saved (to reveal the panel)', async () => {
    const onCreate = vi.fn();
    setup({ onCreate });
    await flush();

    selectWorld();
    document.dispatchEvent(new MouseEvent('mouseup'));
    document.querySelector('[data-action="start-comment"]').click();
    document.querySelector('.annotation-note-input').value = 'look here';
    document.querySelector('[data-action="save-note"]').click();

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('shows the popover from selectionchange (touch, where mouseup never fires)', async () => {
    setup({ selectionDelayMs: 0 });
    await flush();

    selectWorld();
    document.dispatchEvent(new Event('selectionchange'));
    await waitFor(() => document.querySelector('.annotation-popover [data-action="start-comment"]'));

    expect(document.querySelector('.annotation-popover [data-action="start-comment"]')).not.toBeNull();
  });

  it('deletes a note on click', async () => {
    const api = fakeApi([{ id: 'a1', anchorId: 'entry-e1', startOffset: 0, endOffset: 5, text: 'n', original: 'hello' }]);
    setup({ api });
    await flush();
    await tick();
    expect(document.querySelectorAll('.annotation-item')).toHaveLength(1);

    document.querySelector('[data-action="delete"]').click();
    await flush();
    await tick();
    expect(api.remove).toHaveBeenCalledWith('a1');
    expect(document.querySelector('.annotation-empty')).not.toBeNull();
  });

  it('fills the composer when sending transcript notes to pi', async () => {
    const { layer, composer } = setup();
    layer.setAnnotations([
      { id: 'a1', anchorId: 'entry-e1', startOffset: 0, endOffset: 5, text: 'rename this', original: 'hello' },
    ]);
    await tick();
    document.querySelector('[data-action="send-to-pi"]').click();
    expect(composer.value).toContain('continuation of our current task');
    expect(composer.value).toContain('In this conversation:');
    expect(composer.value).toContain('"hello"');
    expect(composer.value).toContain('rename this');
  });

  it('fires onSend before focusing the composer on send-to-pi', async () => {
    const calls = [];
    const onSend = vi.fn(() => calls.push('onSend'));
    const { layer, composer } = setup({ onSend });
    composer.focus = vi.fn(() => calls.push('focus'));
    layer.setAnnotations([
      { id: 'a1', anchorId: 'entry-e1', startOffset: 0, endOffset: 5, text: 'note', original: 'hello' },
    ]);
    await tick();
    document.querySelector('[data-action="send-to-pi"]').click();
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['onSend', 'focus']);
  });

  it('includes file path and line numbers for artifact notes', async () => {
    const messages = document.createElement('div');
    messages.id = 'messages';
    document.body.appendChild(messages);
    const composer = document.createElement('textarea');
    composer.id = 'pi-chat-message';
    document.body.appendChild(composer);
    const content = 'line one\nline two\nline three\nline four\n';
    const resolveArtifact = (id) => (id === 'art-1'
      ? { id: 'art-1', filePath: '/Users/setkyar/milktea/the-silver-flute-of-bagan.md', content }
      : null);

    render(AnnotationLayer);
    const layer = sessionRuntime.annotations;
    layer.init({ api: fakeApi(), scopes: [messages], composerEl: composer, resolveArtifact });
    layer.setAnnotations([
      { id: 'n1', anchorId: 'artifact-art-1', startOffset: 0, endOffset: 4, text: 'add (burmese)', original: 'line' },
      { id: 'n2', anchorId: 'artifact-art-1', startOffset: 9, endOffset: 28, text: 'spans lines', original: 'two..three' },
    ]);
    await tick();
    document.querySelector('[data-action="send-to-pi"]').click();
    const v = composer.value;
    expect(v).toContain('In /Users/setkyar/milktea/the-silver-flute-of-bagan.md:');
    expect(v).toContain('Line 1 — "line"');
    expect(v).toContain('add (burmese)');
    expect(v).toContain('Lines 2-3 — "two..three"');
  });

  it('does not let a slow initial load clobber a newer optimistic create', async () => {
    let releaseList;
    const slow = new Promise((r) => { releaseList = r; });
    const store = [];
    let firstList = true;
    const api = {
      list: vi.fn(() => {
        if (firstList) { firstList = false; return slow; }
        return Promise.resolve(store.slice());
      }),
      create: vi.fn(async (a) => { const s = { ...a, id: 'real-1' }; store.push(s); return s; }),
      remove: vi.fn(),
    };
    setup({ api }); // init() kicks off the slow refresh

    selectWorld();
    document.dispatchEvent(new MouseEvent('mouseup'));
    document.querySelector('[data-action="start-comment"]').click();
    document.querySelector('.annotation-note-input').value = 'keep me';
    document.querySelector('[data-action="save-note"]').click();
    await flush();

    releaseList([]); // stale initial list resolves only now — must be ignored
    await flush();
    await flush();
    await tick();

    expect(document.querySelectorAll('.annotation-item')).toHaveLength(1);
    expect(document.querySelector('.annotation-note').textContent).toBe('keep me');
  });

  it('annotates text inside an artifact scope', async () => {
    const messages = document.createElement('div');
    messages.id = 'messages';
    document.body.appendChild(messages);
    const artHost = document.createElement('div');
    artHost.id = 'artifact-panel-host';
    artHost.innerHTML = '<pre id="artifact-art-1">package main</pre>';
    document.body.appendChild(artHost);
    const count = document.createElement('span');
    count.id = 'annotation-tab-count';
    count.hidden = true;
    document.body.appendChild(count);
    const api = fakeApi();

    render(AnnotationLayer);
    const layer = sessionRuntime.annotations;
    layer.init({ api, scopes: [messages, artHost], countEl: count });
    await flush();

    const node = document.getElementById('artifact-art-1').firstChild;
    const range = document.createRange();
    range.setStart(node, 8); // "main"
    range.setEnd(node, 12);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup'));

    document.querySelector('[data-action="start-comment"]').click();
    document.querySelector('.annotation-note-input').value = 'rename';
    document.querySelector('[data-action="save-note"]').click();
    await flush();
    await flush();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ anchorId: 'artifact-art-1', original: 'main' }));
    expect(document.querySelector('#artifact-art-1 mark.pi-annotation').textContent).toBe('main');
  });

  it('is a no-op when required deps are missing', () => {
    render(AnnotationLayer);
    const layer = sessionRuntime.annotations;
    expect(() => { layer.init({}); layer.setAnnotations([]); layer.reapply(); }).not.toThrow();
  });
});
