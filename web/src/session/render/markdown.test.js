import { describe, expect, it } from 'vitest';
import { Marked } from 'marked';
import hljs from 'highlight.js';
import { configureSessionMarkdown, safeMarkedParse, strictStrikethroughRegex } from './markdown.js';

describe('session markdown', () => {
  it('matches only strict strikethrough markers', () => {
    expect(strictStrikethroughRegex.test('~~gone~~')).toBe(true);
    expect(strictStrikethroughRegex.test('~~ spaced ~~')).toBe(false);
  });

  it('sanitizes unsafe links and treats html as text', () => {
    const instance = new Marked();
    configureSessionMarkdown({ marked: instance, hljs, escapeHtml: (text) => String(text).replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') });

    expect(safeMarkedParse('[x](javascript:alert(1))', { marked: instance })).not.toContain('href=');
    expect(safeMarkedParse('<script>alert(1)</script>', { marked: instance })).toContain('&lt;script&gt;');
  });

  it('renders code blocks through highlight.js wrapper', () => {
    const instance = new Marked();
    configureSessionMarkdown({ marked: instance, hljs, escapeHtml: (text) => String(text) });
    expect(safeMarkedParse('```js\nconst x = 1;\n```', { marked: instance })).toContain('class="hljs"');
  });
});
