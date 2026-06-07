import { describe, expect, it } from 'vitest';
import { formatRelativeTime, groupSessionsByProject, groupSessionsTimeline, normalizeSession, sessionModelLabel, sessionSearchText } from './sessions.js';

describe('index sessions helpers', () => {
  it('normalizes Go and JS-shaped sessions', () => {
    expect(normalizeSession({ ID: 'a', Project: '/repo', ModelProvider: 'p', Model: 'm' })).toMatchObject({
      id: 'a', project: '/repo', modelProvider: 'p', model: 'm', chatAvailable: true,
    });
  });

  it('formats relative times', () => {
    expect(formatRelativeTime('2024-01-01T00:00:00Z', Date.parse('2024-01-01T00:02:00Z'))).toBe('2 minutes ago');
    expect(formatRelativeTime('not a date')).toBe('');
  });

  it('builds labels and search text', () => {
    const session = { name: 'Fix bug', project: '/repo', modelProvider: 'openai', model: 'gpt', sessionUUID: 'uuid' };
    expect(sessionModelLabel(session)).toBe('openai/gpt');
    expect(sessionSearchText(session)).toContain('Fix bug /repo openai/gpt uuid');
  });

  it('groups project layout by latest activity', () => {
    const groups = groupSessionsByProject([
      { id: 'old', project: 'a', lastActivity: '2024-01-01T00:00:00Z' },
      { id: 'new', project: 'b', lastActivity: '2024-01-03T00:00:00Z' },
      { id: 'mid', project: 'a', lastActivity: '2024-01-02T00:00:00Z' },
    ]);
    expect(groups.map((g) => g.project)).toEqual(['b', 'a']);
    expect(groups[1].sessions.map((s) => s.id)).toEqual(['mid', 'old']);
  });

  it('groups timeline whenever the project changes in activity order', () => {
    const groups = groupSessionsTimeline([
      { id: '1', project: 'a', lastActivity: '2024-01-03T00:00:00Z' },
      { id: '2', project: 'b', lastActivity: '2024-01-02T00:00:00Z' },
      { id: '3', project: 'a', lastActivity: '2024-01-01T00:00:00Z' },
    ]);
    expect(groups.map((g) => `${g.project}:${g.sessions[0].id}`)).toEqual(['a:1', 'b:2', 'a:3']);
  });
});
