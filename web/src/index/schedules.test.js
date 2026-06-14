import { describe, it, expect } from 'vitest';
import { buildCron, parseCron, describeFrequency, FREQUENCIES } from './schedules.js';

describe('buildCron', () => {
  it('returns empty for manual and custom', () => {
    expect(buildCron({ frequency: 'manual' })).toBe('');
    expect(buildCron({ frequency: 'custom' })).toBe('');
  });
  it('builds hourly from minute only', () => {
    expect(buildCron({ frequency: 'hourly', minute: 30 })).toBe('30 * * * *');
  });
  it('builds daily from time', () => {
    expect(buildCron({ frequency: 'daily', minute: 5, hour: 9 })).toBe('5 9 * * *');
  });
  it('builds weekdays', () => {
    expect(buildCron({ frequency: 'weekdays', minute: 0, hour: 8 })).toBe('0 8 * * 1-5');
  });
  it('builds weekly with day-of-week', () => {
    expect(buildCron({ frequency: 'weekly', minute: 0, hour: 17, weekday: 5 })).toBe('0 17 * * 5');
  });
  it('clamps out-of-range values', () => {
    expect(buildCron({ frequency: 'daily', minute: 99, hour: 40 })).toBe('59 23 * * *');
  });
});

describe('parseCron', () => {
  it('treats empty as manual', () => {
    expect(parseCron('').frequency).toBe('manual');
  });
  it('round-trips presets built by buildCron', () => {
    for (const f of ['hourly', 'daily', 'weekdays', 'weekly']) {
      const expr = buildCron({ frequency: f, minute: 15, hour: 10, weekday: 3 });
      const parsed = parseCron(expr);
      expect(parsed.frequency).toBe(f);
    }
  });
  it('recovers fields for weekly', () => {
    const parsed = parseCron('15 10 * * 3');
    expect(parsed).toMatchObject({ frequency: 'weekly', minute: 15, hour: 10, weekday: 3 });
  });
  it('falls back to custom for unrecognized shapes', () => {
    expect(parseCron('*/15 9 1 * *').frequency).toBe('custom');
    expect(parseCron('0 9 * *').frequency).toBe('custom');
  });
});

describe('describeFrequency', () => {
  const tr = (key, params) => `${key}:${JSON.stringify(params || {})}`;
  it('describes manual', () => {
    expect(describeFrequency({ cronExpr: '' }, tr)).toContain('freqManual');
  });
  it('describes daily with time', () => {
    expect(describeFrequency({ cronExpr: '5 9 * * *' }, tr)).toContain('09:05');
  });
  it('returns the raw expression for custom', () => {
    expect(describeFrequency({ cronExpr: '*/15 9 1 * *' }, tr)).toBe('*/15 9 1 * *');
  });
});

describe('FREQUENCIES', () => {
  it('lists all supported presets', () => {
    expect(FREQUENCIES).toEqual(['manual', 'hourly', 'daily', 'weekdays', 'weekly', 'custom']);
  });
});
