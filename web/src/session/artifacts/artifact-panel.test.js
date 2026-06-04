import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createArtifactPanel } from './artifact-panel.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function setup({ highlight = null, clipboard } = {}) {
  const dom = new JSDOM('<div id="host"></div>');
  const { document: doc, window: win } = dom.window;
  const navigatorImpl = clipboard ? { clipboard } : {};
  const created = [];
  const URLImpl = {
    createObjectURL: vi.fn(() => 'blob:x'),
    revokeObjectURL: vi.fn()
  };
  class BlobImpl {
    constructor(parts) { this.parts = parts; created.push(parts); }
  }
  const panel = createArtifactPanel({
    host: doc.getElementById('host'),
    escapeHtml,
    highlight,
    documentImpl: doc,
    windowImpl: win,
    navigatorImpl,
    URLImpl,
    BlobImpl
  });
  return { dom, doc, win, panel, URLImpl, created };
}

const arts = [
  { id: 'a1', kind: 'code', title: 'util.go', lang: 'go', content: 'package main', filePath: 'src/util.go' },
  { id: 'a2', kind: 'preview', previewType: 'html', title: 'page.html', lang: 'html', content: '<h1>hi</h1>', filePath: 'page.html' }
];

describe('artifact panel', () => {
  it('renders an empty state with no artifacts', () => {
    const { doc, panel } = setup();
    panel.setArtifacts([]);
    expect(doc.querySelector('.artifact-empty')).not.toBeNull();
    expect(panel.getCount()).toBe(0);
  });

  it('shows a filter hint in the empty state when artifacts are hidden', () => {
    const { doc, panel } = setup();
    panel.setArtifacts([], { hiddenCount: 3 });
    const empty = doc.querySelector('.artifact-empty');
    expect(empty.textContent).toContain('3 artifacts hidden by your filter');
    expect(empty.querySelector('a[href="/settings"]')).not.toBeNull();
  });

  it('singularizes the filter hint for a single hidden artifact', () => {
    const { doc, panel } = setup();
    panel.setArtifacts([], { hiddenCount: 1 });
    expect(doc.querySelector('.artifact-empty').textContent).toContain('1 artifact hidden');
  });

  it('lists artifacts and auto-selects the first', () => {
    const { doc, panel } = setup();
    panel.setArtifacts(arts);
    expect(doc.querySelectorAll('.artifact-list-item')).toHaveLength(2);
    expect(panel.getSelectedId()).toBe('a1');
    expect(doc.querySelector('.artifact-list-item.active').dataset.artifactId).toBe('a1');
    expect(doc.querySelector('.artifact-view-title').textContent).toBe('util.go');
    expect(doc.querySelector('.artifact-source').textContent).toContain('package main');
  });

  it('shows a preview badge for preview-kind artifacts', () => {
    const { doc, panel } = setup();
    panel.setArtifacts(arts);
    const second = doc.querySelector('[data-artifact-id="a2"]');
    expect(second.querySelector('.artifact-badge')).not.toBeNull();
  });

  it('selects a different artifact on click', () => {
    const { doc, panel } = setup();
    panel.setArtifacts(arts);
    doc.querySelector('[data-artifact-id="a2"]').click();
    expect(panel.getSelectedId()).toBe('a2');
    expect(doc.querySelector('.artifact-view-title').textContent).toBe('page.html');
  });

  it('uses highlight output when available, else falls back to escaped text', () => {
    const highlight = vi.fn(() => '<span class="tok">x</span>');
    const { doc, panel } = setup({ highlight });
    panel.setArtifacts(arts);
    expect(highlight).toHaveBeenCalled();
    expect(doc.querySelector('.artifact-source code').innerHTML).toContain('tok');

    const plain = setup({ highlight: null });
    plain.panel.setArtifacts([{ id: 'x', kind: 'code', title: 't', lang: '', content: '<b>raw</b>' }]);
    expect(plain.doc.querySelector('.artifact-source code').innerHTML).toContain('&lt;b&gt;');
    expect(plain.doc.querySelector('code[data-highlight-pending]')).not.toBeNull();
  });

  it('copies source to clipboard and gives feedback', async () => {
    const writeText = vi.fn().mockResolvedValue();
    const { doc, panel } = setup({ clipboard: { writeText } });
    panel.setArtifacts(arts);
    const copyBtn = doc.querySelector('[data-action="copy"]');
    copyBtn.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('package main');
  });

  it('downloads the selected artifact using its filename', () => {
    const { doc, panel, URLImpl, created } = setup();
    panel.setArtifacts(arts);
    const clickSpy = vi.fn();
    const realCreate = doc.createElement.bind(doc);
    vi.spyOn(doc, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });
    doc.querySelector('[data-action="download"]').click();
    expect(created[0]).toEqual(['package main']);
    expect(clickSpy).toHaveBeenCalled();
    expect(URLImpl.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('keeps the selection when setArtifacts is called with the same id', () => {
    const { panel } = setup();
    panel.setArtifacts(arts);
    panel.selectArtifact('a2');
    panel.setArtifacts(arts);
    expect(panel.getSelectedId()).toBe('a2');
  });

  it('shows no preview toggle for code-kind artifacts', () => {
    const { doc, panel } = setup();
    panel.setArtifacts(arts); // a1 (code) selected by default
    expect(doc.querySelector('[data-action="toggle-preview"]')).toBeNull();
  });

  it('runs a preview-kind artifact in a locked-down sandboxed iframe', () => {
    const { doc, panel } = setup();
    panel.setArtifacts(arts);
    panel.selectArtifact('a2'); // page.html, kind: preview

    const toggle = doc.querySelector('[data-action="toggle-preview"]');
    expect(toggle.textContent).toBe('Run preview');
    expect(doc.querySelector('.artifact-preview')).toBeNull(); // click-to-run: nothing yet

    toggle.click();

    const frame = doc.querySelector('iframe.artifact-preview');
    expect(frame).not.toBeNull();
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame.srcdoc).toContain('<h1>hi</h1>');
    expect(frame.srcdoc).toContain('Content-Security-Policy');
    expect(frame.srcdoc).toContain("default-src 'none'");
    expect(doc.querySelector('[data-action="toggle-preview"]').textContent).toBe('Show source');
    expect(doc.querySelector('.artifact-source')).toBeNull();
  });

  it('renders markdown previews inline via renderMarkdown (not an iframe)', () => {
    const renderMarkdown = vi.fn((md) => `<h1>${md.replace('# ', '')}</h1>`);
    const dom = new JSDOM('<div id="host"></div>');
    const doc = dom.window.document;
    const panel = createArtifactPanel({
      host: doc.getElementById('host'),
      escapeHtml,
      renderMarkdown,
      documentImpl: doc,
      windowImpl: dom.window
    });
    panel.setArtifacts([{ id: 'm1', kind: 'preview', previewType: 'markdown', title: 'README.md', lang: 'markdown', content: '# Hello' }]);

    const toggle = doc.querySelector('[data-action="toggle-preview"]');
    expect(toggle.textContent).toBe('Preview'); // gentler label for non-executable md
    toggle.click();

    expect(renderMarkdown).toHaveBeenCalledWith('# Hello');
    expect(doc.querySelector('iframe.artifact-preview')).toBeNull();
    expect(doc.querySelector('.artifact-markdown h1').textContent).toBe('Hello');
  });

  it('gives the source view an artifact-<id> anchor for annotations', () => {
    const { doc, panel } = setup();
    panel.setArtifacts(arts);
    expect(doc.querySelector('pre.artifact-source#artifact-a1')).not.toBeNull();
  });

  it('toggles back from preview to source', () => {
    const { doc, panel } = setup();
    panel.setArtifacts(arts);
    panel.selectArtifact('a2');
    doc.querySelector('[data-action="toggle-preview"]').click();
    doc.querySelector('[data-action="toggle-preview"]').click();
    expect(doc.querySelector('.artifact-preview')).toBeNull();
    expect(doc.querySelector('.artifact-source').textContent).toContain('<h1>hi</h1>');
  });

  it('resets to source view when a different artifact is selected', () => {
    const { doc, panel } = setup();
    panel.setArtifacts(arts);
    panel.selectArtifact('a2');
    doc.querySelector('[data-action="toggle-preview"]').click();
    expect(doc.querySelector('.artifact-preview')).not.toBeNull();

    panel.selectArtifact('a1');
    panel.selectArtifact('a2');
    expect(doc.querySelector('.artifact-preview')).toBeNull();
    expect(doc.querySelector('[data-action="toggle-preview"]').textContent).toBe('Run preview');
  });

  it('throws without a host or escapeHtml', () => {
    expect(() => createArtifactPanel({ escapeHtml })).toThrow(/host/);
    const dom = new JSDOM('<div id="h"></div>');
    expect(() => createArtifactPanel({ host: dom.window.document.getElementById('h') })).toThrow(/escapeHtml/);
  });
});
