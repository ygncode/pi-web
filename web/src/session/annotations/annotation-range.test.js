import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  findAnchor,
  isAnnotationAnchor,
  getSelectionInfo,
  wrapRange,
  unwrapAll,
  applyHighlights
} from './annotation-range.js';

function domWith(html) {
  const dom = new JSDOM(`<div id="messages">${html}</div>`);
  return { doc: dom.window.document, win: dom.window };
}

function selectRange(win, doc, startNode, startOff, endNode, endOff) {
  const range = doc.createRange();
  range.setStart(startNode, startOff);
  range.setEnd(endNode, endOff);
  const sel = win.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return sel;
}

describe('findAnchor', () => {
  it('walks up to the nearest entry-* element', () => {
    const { doc } = domWith('<div id="entry-e1"><span class="x">hi</span></div>');
    const span = doc.querySelector('.x');
    expect(findAnchor(span.firstChild).id).toBe('entry-e1');
  });

  it('returns null outside any anchor', () => {
    const { doc } = domWith('<div class="no-id">hi</div>');
    expect(findAnchor(doc.querySelector('.no-id').firstChild)).toBeNull();
  });

  it('treats both entry-* and artifact-* ids as anchors', () => {
    const { doc } = domWith('<pre id="artifact-art-c1"><code>x</code></pre>');
    expect(isAnnotationAnchor(doc.getElementById('artifact-art-c1'))).toBe(true);
    expect(findAnchor(doc.querySelector('code').firstChild).id).toBe('artifact-art-c1');
    expect(isAnnotationAnchor(doc.querySelector('.no-id'))).toBe(false);
  });
});

describe('getSelectionInfo', () => {
  it('measures offsets and text against the anchor', () => {
    const { doc, win } = domWith('<div id="entry-e1">hello world</div>');
    const textNode = doc.getElementById('entry-e1').firstChild;
    const sel = selectRange(win, doc, textNode, 6, textNode, 11);

    const info = getSelectionInfo(sel, { documentImpl: doc });
    expect(info).toMatchObject({ anchorId: 'entry-e1', start: 6, end: 11, text: 'world' });
  });

  it('returns null for collapsed selections', () => {
    const { doc, win } = domWith('<div id="entry-e1">hello</div>');
    const t = doc.getElementById('entry-e1').firstChild;
    const sel = selectRange(win, doc, t, 2, t, 2);
    expect(getSelectionInfo(sel, { documentImpl: doc })).toBeNull();
  });

  it('rejects selections that span two entries', () => {
    const { doc, win } = domWith('<div id="entry-e1">aaa</div><div id="entry-e2">bbb</div>');
    const a = doc.getElementById('entry-e1').firstChild;
    const b = doc.getElementById('entry-e2').firstChild;
    const sel = selectRange(win, doc, a, 1, b, 2);
    expect(getSelectionInfo(sel, { documentImpl: doc })).toBeNull();
  });
});

describe('wrapRange / unwrapAll', () => {
  it('wraps a range within a single text node', () => {
    const { doc } = domWith('<div id="entry-e1">hello world</div>');
    const anchor = doc.getElementById('entry-e1');
    expect(wrapRange(anchor, 0, 5, { dataset: { annotationId: 'a1' }, documentImpl: doc })).toBe(true);
    const mark = anchor.querySelector('mark.pi-annotation');
    expect(mark.textContent).toBe('hello');
    expect(mark.dataset.annotationId).toBe('a1');
    expect(anchor.textContent).toBe('hello world'); // text content unchanged
  });

  it('wraps a range that lands inside a nested element', () => {
    const { doc } = domWith('<div id="entry-e1">a <b>bold</b> c</div>');
    const anchor = doc.getElementById('entry-e1');
    wrapRange(anchor, 2, 6, { documentImpl: doc });
    expect(anchor.querySelector('mark.pi-annotation').textContent).toBe('bold');
  });

  it('unwrapAll restores plain text', () => {
    const { doc } = domWith('<div id="entry-e1">hello world</div>');
    const anchor = doc.getElementById('entry-e1');
    wrapRange(anchor, 0, 5, { documentImpl: doc });
    unwrapAll(anchor);
    expect(anchor.querySelector('mark')).toBeNull();
    expect(anchor.textContent).toBe('hello world');
  });
});

describe('applyHighlights', () => {
  const annotations = [
    { id: 'a1', anchorId: 'entry-e1', startOffset: 0, endOffset: 5 },
    { id: 'a2', anchorId: 'entry-e2', startOffset: 1, endOffset: 3 }
  ];

  it('applies highlights from offsets across anchors', () => {
    const { doc } = domWith('<div id="entry-e1">hello world</div><div id="entry-e2">abcd</div>');
    applyHighlights(doc.getElementById('messages'), annotations, { documentImpl: doc });
    expect(doc.querySelectorAll('mark.pi-annotation')).toHaveLength(2);
    expect(doc.querySelector('[data-annotation-id="a1"]').textContent).toBe('hello');
    expect(doc.querySelector('[data-annotation-id="a2"]').textContent).toBe('bc');
  });

  it('is idempotent — repeated calls do not stack marks', () => {
    const { doc } = domWith('<div id="entry-e1">hello world</div><div id="entry-e2">abcd</div>');
    const container = doc.getElementById('messages');
    applyHighlights(container, annotations, { documentImpl: doc });
    applyHighlights(container, annotations, { documentImpl: doc });
    expect(doc.querySelectorAll('mark.pi-annotation')).toHaveLength(2);
  });

  it('skips annotations whose anchor is absent', () => {
    const { doc } = domWith('<div id="entry-e1">hello world</div>');
    applyHighlights(doc.getElementById('messages'), annotations, { documentImpl: doc });
    expect(doc.querySelectorAll('mark.pi-annotation')).toHaveLength(1);
  });
});
