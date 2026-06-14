import { describe, it, expect } from 'vitest';
import { buildReviewPrompt } from './diff-review.js';

describe('buildReviewPrompt', () => {
  it('returns empty string for no comments', () => {
    expect(buildReviewPrompt([])).toBe('');
    expect(buildReviewPrompt(null)).toBe('');
  });

  it('groups by file and orders by line', () => {
    const prompt = buildReviewPrompt([
      { file: 'b.js', startLine: 5, endLine: 5, side: 'new', body: 'second file' },
      { file: 'a.go', startLine: 10, endLine: 12, side: 'new', body: 'rename this' },
      { file: 'a.go', startLine: 3, endLine: 3, side: 'old', body: 'drop this' },
    ]);
    expect(prompt).toContain('### a.go');
    expect(prompt).toContain('### b.js');
    // a.go comments ordered by startLine: line 3 before lines 10-12.
    expect(prompt.indexOf('Line 3 (old): drop this')).toBeLessThan(
      prompt.indexOf('Lines 10-12: rename this'),
    );
    expect(prompt).toContain('Line 5: second file');
  });
});
