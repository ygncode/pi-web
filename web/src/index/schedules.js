import { getJSON, postJSON } from '../shared/api.js';

// Frequency presets the editor offers. 'custom' surfaces a raw cron field;
// 'manual' stores no cron (Run-now only). All others are sugar that compile to a
// standard 5-field cron expression via buildCron().
export const FREQUENCIES = ['manual', 'hourly', 'daily', 'weekdays', 'weekly', 'custom'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

// buildCron compiles a preset + time fields into a standard cron expression.
// minute 0-59, hour 0-23, weekday 0-6 (0=Sunday). Returns '' for manual/custom
// (custom carries its own raw expression).
export function buildCron({ frequency, minute = 0, hour = 9, weekday = 1 } = {}) {
  const m = clampInt(minute, 0, 59, 0);
  const h = clampInt(hour, 0, 23, 9);
  const d = clampInt(weekday, 0, 6, 1);
  switch (frequency) {
    case 'hourly':
      return `${m} * * * *`;
    case 'daily':
      return `${m} ${h} * * *`;
    case 'weekdays':
      return `${m} ${h} * * 1-5`;
    case 'weekly':
      return `${m} ${h} * * ${d}`;
    default:
      return '';
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// parseCron does the inverse of buildCron for editing: it recognizes the shapes
// buildCron emits and reports the matching preset + fields. Anything else is
// reported as 'custom' so the raw expression stays editable and lossless.
export function parseCron(expr) {
  const trimmed = (expr || '').trim();
  if (!trimmed) return { frequency: 'manual', minute: 0, hour: 9, weekday: 1 };
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return { frequency: 'custom', minute: 0, hour: 9, weekday: 1 };
  const [min, hr, dom, mon, dow] = parts;
  const minute = numOrNull(min);
  const hour = numOrNull(hr);
  if (minute === null || dom !== '*' || mon !== '*') {
    return { frequency: 'custom', minute: 0, hour: 9, weekday: 1 };
  }
  if (hr === '*' && dow === '*') {
    return { frequency: 'hourly', minute, hour: 9, weekday: 1 };
  }
  if (hour === null) return { frequency: 'custom', minute: 0, hour: 9, weekday: 1 };
  if (dow === '*') return { frequency: 'daily', minute, hour, weekday: 1 };
  if (dow === '1-5') return { frequency: 'weekdays', minute, hour, weekday: 1 };
  const weekday = numOrNull(dow);
  if (weekday !== null && weekday >= 0 && weekday <= 6) {
    return { frequency: 'weekly', minute, hour, weekday };
  }
  return { frequency: 'custom', minute: 0, hour: 9, weekday: 1 };
}

function numOrNull(s) {
  if (!/^\d+$/.test(s)) return null;
  return Number.parseInt(s, 10);
}

// describeFrequency renders a short human label for a schedule's cadence. tr is
// the t() translator; passing it keeps this module free of an i18n import.
export function describeFrequency(schedule, tr) {
  const t = tr || ((k) => k);
  const expr = (schedule.cronExpr || '').trim();
  if (!expr) return t('schedules.freqManual');
  const { frequency, minute, hour, weekday } = parseCron(expr);
  const time = `${pad2(hour)}:${pad2(minute)}`;
  switch (frequency) {
    case 'hourly':
      return t('schedules.freqHourlyAt', { minute: pad2(minute) });
    case 'daily':
      return t('schedules.freqDailyAt', { time });
    case 'weekdays':
      return t('schedules.freqWeekdaysAt', { time });
    case 'weekly':
      return t('schedules.freqWeeklyAt', { day: t('schedules.weekday' + weekday), time });
    default:
      return expr;
  }
}

export function defaultFetchSchedules() {
  return getJSON('/api/schedules');
}
export function defaultFetchScheduleRuns(id) {
  return getJSON('/api/schedule/runs?id=' + encodeURIComponent(id));
}
export function defaultCreateSchedule(payload) {
  return postJSON('/api/schedules', payload);
}
export function defaultUpdateSchedule(id, payload) {
  return postJSON('/api/schedule?id=' + encodeURIComponent(id), payload);
}
export function defaultRunSchedule(id) {
  return postJSON('/api/schedule/run?id=' + encodeURIComponent(id), {});
}
export async function defaultDeleteSchedule(id, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl('/api/schedule?id=' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      if (payload && payload.error) message = payload.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json();
}
export function defaultFetchModels() {
  return getJSON('/api/models');
}
export function defaultFetchRecent() {
  return getJSON('/api/recent-locations');
}

// guessTimezone returns the browser's IANA timezone, falling back to ''.
export function guessTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}
