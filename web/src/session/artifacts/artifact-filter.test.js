import { describe, it, expect } from 'vitest';
import {
  parsePatterns,
  matchesPath,
  filterArtifacts,
  readArtifactSettings,
} from './artifact-filter.js';

const file = (filePath) => ({ id: filePath, filePath, content: 'x' });
const snippet = (id) => ({ id, filePath: null, content: 'x', source: 'fenced' });

describe('parsePatterns', () => {
  it('splits on commas and whitespace, dropping blanks', () => {
    expect(parsePatterns('*.md, *.html')).toEqual(['*.md', '*.html']);
    expect(parsePatterns('  *.md \n *.html  ')).toEqual(['*.md', '*.html']);
  });

  it('normalizes bare extension tokens to *.ext', () => {
    expect(parsePatterns('.md, .html')).toEqual(['*.md', '*.html']);
  });

  it('leaves path tokens with a dot prefix alone', () => {
    expect(parsePatterns('./docs/*.md')).toEqual(['./docs/*.md']);
  });

  it('returns [] for empty or non-string input', () => {
    expect(parsePatterns('')).toEqual([]);
    expect(parsePatterns('   ')).toEqual([]);
    expect(parsePatterns(null)).toEqual([]);
  });
});

describe('matchesPath', () => {
  const md = parsePatterns('*.md');
  it('matches a basename glob regardless of directory', () => {
    expect(matchesPath('report.md', md)).toBe(true);
    expect(matchesPath('deep/nested/report.md', md)).toBe(true);
    expect(matchesPath('report.txt', md)).toBe(false);
  });

  it('matches a full-path glob when the pattern has a slash', () => {
    const p = parsePatterns('artifacts/**');
    expect(matchesPath('artifacts/a.go', p)).toBe(true);
    expect(matchesPath('artifacts/deep/a.go', p)).toBe(true);
    expect(matchesPath('src/a.go', p)).toBe(false);
  });

  it('single * does not cross slashes; ** does', () => {
    expect(matchesPath('docs/deep/a.md', parsePatterns('docs/*.md'))).toBe(false);
    expect(matchesPath('docs/a.md', parsePatterns('docs/*.md'))).toBe(true);
    expect(matchesPath('docs/deep/a.md', parsePatterns('docs/**'))).toBe(true);
  });

  it('escapes regex metacharacters in the pattern', () => {
    expect(matchesPath('a.md', parsePatterns('a.md'))).toBe(true);
    expect(matchesPath('axmd', parsePatterns('a.md'))).toBe(false);
  });

  it('returns false for empty/non-string path', () => {
    expect(matchesPath('', md)).toBe(false);
    expect(matchesPath(null, md)).toBe(false);
  });
});

describe('filterArtifacts', () => {
  it('returns nothing when disabled', () => {
    const r = filterArtifacts([file('a.md'), snippet('s')], { enabled: false, include: '*.md' });
    expect(r.visible).toEqual([]);
    expect(r.hiddenCount).toBe(0);
  });

  it('returns everything when include is empty', () => {
    const arts = [file('a.go'), snippet('s')];
    const r = filterArtifacts(arts, { enabled: true, include: '' });
    expect(r.visible).toEqual(arts);
    expect(r.hiddenCount).toBe(0);
  });

  it('keeps only matching files and drops snippets when include is non-empty', () => {
    const arts = [file('a.md'), file('b.go'), snippet('s1'), file('docs/c.html')];
    const r = filterArtifacts(arts, { enabled: true, include: '*.md, *.html' });
    expect(r.visible.map((a) => a.id)).toEqual(['a.md', 'docs/c.html']);
    expect(r.hiddenCount).toBe(2); // b.go + snippet
  });

  it('handles a non-array input gracefully', () => {
    expect(filterArtifacts(null, { enabled: true, include: '' })).toEqual({ visible: [], hiddenCount: 0 });
  });
});

describe('readArtifactSettings', () => {
  function fakeStorage(map) {
    return { getItem: (k) => (k in map ? map[k] : null) };
  }

  it('falls back to defaults when storage is empty', () => {
    expect(readArtifactSettings(fakeStorage({}))).toEqual({ enabled: true, include: '*.md, *.html' });
  });

  it('reads stored values', () => {
    const s = fakeStorage({
      'pi-web:v1:artifacts:enabled': 'false',
      'pi-web:v1:artifacts:include': 'artifacts/**',
    });
    expect(readArtifactSettings(s)).toEqual({ enabled: false, include: 'artifacts/**' });
  });

  it('treats only the literal string "true" as enabled', () => {
    const s = fakeStorage({ 'pi-web:v1:artifacts:enabled': 'nope' });
    expect(readArtifactSettings(s).enabled).toBe(false);
  });

  it('survives a throwing storage', () => {
    const s = { getItem() { throw new Error('blocked'); } };
    expect(readArtifactSettings(s)).toEqual({ enabled: true, include: '*.md, *.html' });
  });
});
