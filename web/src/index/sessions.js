import { getJSON, postJSON } from '../shared/api.js';
import { t } from '../shared/i18n.js';

export const layoutStorageKey = 'pi-sessions:view-layout';
export const collapsedProjectsStorageKey = 'pi-sessions:collapsed-projects';

export const sessionsCountLabel = (n) => (n === 1 ? t('index.sessionCountOne') : t('index.sessionsCount', { count: n }));

export function normalizeSession(raw = {}) {
  return {
    id: raw.id || raw.ID || '',
    sessionUUID: raw.sessionUUID || raw.SessionUUID || '',
    project: raw.project || raw.Project || '',
    lastActivity: raw.lastActivity || raw.LastActivity || '',
    name: raw.name || raw.Name || raw.id || raw.ID || '',
    messageCount: raw.messageCount ?? raw.MessageCount ?? 0,
    tokenTotal: raw.tokenTotal ?? raw.TokenTotal ?? 0,
    costTotal: raw.costTotal ?? raw.CostTotal ?? 0,
    model: raw.model || raw.Model || '',
    modelProvider: raw.modelProvider || raw.ModelProvider || '',
    chatAvailable: raw.chatAvailable ?? raw.ChatAvailable ?? true,
    chatDisabledReason: raw.chatDisabledReason || raw.ChatDisabledReason || '',
  };
}

export function activityMs(session) {
  const ms = Date.parse(session?.lastActivity || session?.LastActivity || '');
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

export function formatRelativeTime(timestamp, now = Date.now()) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ];
  for (const [name, size] of units) {
    const count = Math.floor(seconds / size);
    if (count >= 1) return `${count} ${name}${count === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

export function sessionModelLabel(session = {}) {
  if (!session.model) return '';
  return session.modelProvider ? `${session.modelProvider}/${session.model}` : session.model;
}

export function sessionSearchText(session = {}) {
  return `${session.name || ''} ${session.project || ''} ${sessionModelLabel(session)} ${session.sessionUUID || ''}`.trim();
}

export function formatRunningModel(status) {
  if (!status || typeof status !== 'object') return '';
  const model = typeof status.modelName === 'string' && status.modelName ? status.modelName
    : typeof status.model === 'string' ? status.model : '';
  const provider = typeof status.modelProvider === 'string' ? status.modelProvider : '';
  if (model && provider) return `${provider}/${model}`;
  return model || provider;
}

export function groupSessionsByProject(sessions = []) {
  const groups = [];
  const byProject = new Map();
  for (const session of sessions) {
    const project = session.project || '';
    let group = byProject.get(project);
    if (!group) {
      group = { project, sessions: [], latest: Number.NEGATIVE_INFINITY, index: groups.length };
      byProject.set(project, group);
      groups.push(group);
    }
    group.sessions.push(session);
    group.latest = Math.max(group.latest, activityMs(session));
  }
  groups.forEach((group) => group.sessions.sort((a, b) => activityMs(b) - activityMs(a)));
  groups.sort((a, b) => (b.latest - a.latest) || (a.index - b.index));
  return groups;
}

export function groupSessionsTimeline(sessions = []) {
  const sorted = [...sessions].sort((a, b) => activityMs(b) - activityMs(a));
  const groups = [];
  let current = null;
  for (const session of sorted) {
    const project = session.project || '';
    if (!current || current.project !== project) {
      current = { project, sessions: [] };
      groups.push(current);
    }
    current.sessions.push(session);
  }
  return groups;
}

export function filterSessions(sessions = [], query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return sessions;
  return sessions.filter((session) => sessionSearchText(session).toLowerCase().includes(q));
}

export function defaultFetchSessions() { return getJSON('/api/sessions'); }
export function defaultFetchRecent() { return getJSON('/api/recent-locations'); }
export function defaultCreateSession(path) { return postJSON('/api/new-session', { path }); }
export function defaultFetchProjects() { return getJSON('/api/projects'); }
export function defaultUpdateProject(path, action) { return postJSON('/api/projects', { path, action }); }
