import { describe, it, expect } from 'vitest';
import { icon, X, PanelLeft } from './icons.js';

describe('icon()', () => {
  it('renders a Lucide icon to an svg string with default attrs', () => {
    const svg = icon(X);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('width="16"');
    expect(svg).toContain('height="16"');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('<path');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('applies size, class and strokeWidth options', () => {
    const svg = icon(PanelLeft, { size: 14, class: 'foo', strokeWidth: 1.5 });
    expect(svg).toContain('width="14"');
    expect(svg).toContain('height="14"');
    expect(svg).toContain('class="foo"');
    expect(svg).toContain('stroke-width="1.5"');
  });
});
