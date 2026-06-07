import { describe, it, expect } from 'vitest';
import { renderChangelog, versionLabel, cleanVersion, shortVersion } from './version.js';

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

describe('version labels', () => {
  it('formats and shortens versions', () => {
    expect(cleanVersion('v2.3.4')).toBe('v2.3.4');
    expect(shortVersion('v0.0.1-beta.24-3-gd7e8bf2-dirty')).toBe('v0.0.1-beta.24');
    expect(versionLabel({ current: '1.0.0', latest: '1.1.0', hasUpdate: true })).toBe('v1.0.0 → v1.1.0');
  });
});
