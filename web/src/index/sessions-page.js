import { getJSON, postJSON } from '../shared/api.js';
import { createStatusEvents as defaultCreateStatusEvents } from '../shared/status-events.js';
import { renderSessionCard } from './session-card.js';
import { t } from '../shared/i18n.js';

const sessionsCountLabel = (n) => (n === 1 ? t('index.sessionCountOne') : t('index.sessionsCount', { count: n }));

function defaultNavigate(url) {
  window.location = url;
}

function sessionCards(root = document) {
  return Array.from(root.querySelectorAll('.session-card[data-session-id]'));
}

function formatRunningModel(status) {
  if (!status || typeof status !== 'object') return '';
  const model = typeof status.modelName === 'string' && status.modelName ? status.modelName
    : typeof status.model === 'string' ? status.model : '';
  const provider = typeof status.modelProvider === 'string' ? status.modelProvider : '';
  if (model && provider) return `${provider}/${model}`;
  return model || provider;
}

function syncRunningCardClasses(runningSessionIds, runningStatuses = new Map(), root = document) {
  sessionCards(root).forEach((card) => {
    const id = card.dataset.sessionId;
    const running = !!id && runningSessionIds.has(id);
    card.classList.toggle('session-card--running', running);
    const model = running ? formatRunningModel(runningStatuses.get(id)) : '';
    const runningModelEl = card.querySelector('[data-running-model]');
    if (runningModelEl) runningModelEl.textContent = model;
    const sessionModelEl = card.querySelector('[data-session-model]');
    if (sessionModelEl && model) sessionModelEl.textContent = model;
  });
}

function normalizeSession(raw = {}) {
  return {
    id: raw.id || raw.ID || '',
    sessionUUID: raw.sessionUUID || raw.SessionUUID || '',
    project: raw.project || raw.Project || '',
    lastActivity: raw.lastActivity || raw.LastActivity || '',
    name: raw.name || raw.Name || '',
    messageCount: raw.messageCount ?? raw.MessageCount ?? 0,
    tokenTotal: raw.tokenTotal ?? raw.TokenTotal ?? 0,
    costTotal: raw.costTotal ?? raw.CostTotal ?? 0,
    model: raw.model || raw.Model || '',
    modelProvider: raw.modelProvider || raw.ModelProvider || '',
    chatAvailable: raw.chatAvailable ?? raw.ChatAvailable ?? true,
    chatDisabledReason: raw.chatDisabledReason || raw.ChatDisabledReason || ''
  };
}

function activityMs(session) {
  const ms = Date.parse(session?.lastActivity || session?.LastActivity || '');
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function groupSessionsByProject(sessions = []) {
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
  groups.forEach((group) => {
    group.sessions.sort((a, b) => activityMs(b) - activityMs(a));
  });
  groups.sort((a, b) => (b.latest - a.latest) || (a.index - b.index));
  return groups;
}

function renderProjectGroups(sessions = []) {
  return groupSessionsByProject(sessions).map((group) => `
    <div class="project-group" data-project="${escapeHtml(group.project)}">
      <button class="project-toggle" type="button" aria-expanded="true">
        <svg class="project-chevron" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M3 4 L9 4 L6 8 Z"/></svg>
        <span class="project-name">${escapeHtml(group.project)}</span>
        <span class="project-count" data-project-count data-running="0" data-total="${group.sessions.length}">${sessionsCountLabel(group.sessions.length)}</span>
      </button>
      <div class="session-grid">${group.sessions.map(renderSessionCard).join('')}</div>
    </div>`).join('');
}

function renderTimeline(sessions = []) {
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
  return groups.map((group) => `
    <div class="project-group timeline-group" data-project="${escapeHtml(group.project)}">
      <button class="project-toggle" type="button" aria-expanded="true">
        <svg class="project-chevron" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M3 4 L9 4 L6 8 Z"/></svg>
        <span class="project-name">${escapeHtml(group.project)}</span>
        <span class="project-count" data-project-count data-running="0" data-total="${group.sessions.length}">${sessionsCountLabel(group.sessions.length)}</span>
      </button>
      <div class="session-grid session-grid--timeline">${group.sessions.map(renderSessionCard).join('')}</div>
    </div>`).join('');
}

function renderSessionsList(sessions = [], root = document, layout = 'projects') {
  const container = root.querySelector('[data-sessions-content]');
  if (!container) return false;
  container.classList.toggle('content--timeline', layout === 'timeline');
  if (sessions.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>${t('index.noSessionsYet')}</h3><p>${t('index.noSessionsYetHint')}</p></div>`;
    return true;
  }
  container.innerHTML = layout === 'timeline' ? renderTimeline(sessions) : renderProjectGroups(sessions);
  root.dispatchEvent(new CustomEvent('pi-index-sessions-rendered', { bubbles: true }));
  return true;
}

function filterSessionCards(query, root = document) {
  const q = query.toLowerCase();
  root.querySelectorAll('.session-card').forEach((card) => {
    const match = (card.dataset.search || '').toLowerCase().includes(q);
    card.classList.toggle('hidden', !match);
  });
  root.querySelectorAll('.project-group').forEach((group) => {
    const anyVisible = group.querySelector('.session-card:not(.hidden)') !== null;
    group.style.display = anyVisible ? '' : 'none';
  });
}

export function createSessionsPage({
  root = document,
  fetchRecent = () => getJSON('/api/recent-locations'),
  fetchSessions = () => getJSON('/api/sessions'),
  createSession = (path) => postJSON('/api/new-session', { path }),
  fetchProjects = () => getJSON('/api/projects'),
  updateProject = (path, action) => postJSON('/api/projects', { path, action }),
  createStatusEvents = defaultCreateStatusEvents,
  navigate = defaultNavigate,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout
} = {}) {
  return {
    query: '',
    modal: false,
    path: '',
    recent: [],
    creating: false,
    error: '',
    layout: 'timeline',
    runningSessionIds: new Set(),
    runningStatuses: new Map(),
    _statusEvents: null,
    _reloadTimer: null,
    _refreshInflight: false,

    sessionCards() {
      return sessionCards(root);
    },

    syncRunningCardClasses() {
      syncRunningCardClasses(this.runningSessionIds, this.runningStatuses, root);
    },

    isSessionRunning(id) {
      return this.runningSessionIds.has(id);
    },

    setRunningSessions(snapshot) {
      const ids = Array.isArray(snapshot) ? snapshot : snapshot?.ids;
      const statuses = snapshot && !Array.isArray(snapshot) ? snapshot.statuses : {};
      this.runningSessionIds = new Set(Array.isArray(ids) ? ids : []);
      this.runningStatuses = new Map(Object.entries(statuses || {}));
      this.syncRunningCardClasses();
    },

    setSessionRunning(id, running, status = {}) {
      if (running) {
        this.runningSessionIds.add(id);
        this.runningStatuses.set(id, status);
      } else {
        this.runningSessionIds.delete(id);
        this.runningStatuses.delete(id);
      }
      this.syncRunningCardClasses();
    },

    applySnapshot(data) {
      try {
        const payload = JSON.parse(data);
        this.setRunningSessions(payload?.running || []);
      } catch {
        /* malformed snapshot — ignore */
      }
    },

    applyDelta(data) {
      try {
        const payload = JSON.parse(data);
        if (!payload || typeof payload.id !== 'string') return;
        this.setSessionRunning(payload.id, !!payload.running);
      } catch {
        /* malformed delta — ignore */
      }
    },

    async refreshSessions() {
      if (this._refreshInflight) return;
      if (this.modal) return;
      this._refreshInflight = true;
      try {
        const response = await fetchSessions();
        const sessions = (response.sessions || []).map(normalizeSession);
        renderSessionsList(sessions, root, this.layout);
        this.syncRunningCardClasses();
        this.filter();
      } catch {
        // Keep the existing server-rendered list if soft refresh fails.
      } finally {
        this._refreshInflight = false;
      }
    },

    scheduleReload() {
      if (this._reloadTimer) {
        clearTimeoutImpl(this._reloadTimer);
        this._reloadTimer = null;
      }
      if (this.modal) return;
      if (this.query && this.query.trim() !== '') return;
      this._reloadTimer = setTimeoutImpl(() => {
        this._reloadTimer = null;
        this.refreshSessions();
      }, 500);
    },

    cleanup() {
      if (this._reloadTimer) {
        clearTimeoutImpl(this._reloadTimer);
        this._reloadTimer = null;
      }
      if (this._statusEvents) {
        this._statusEvents.cleanup();
        this._statusEvents = null;
      }
    },

    subscribe() {
      try {
        this.cleanup();
        this._statusEvents = createStatusEvents({
          onSnapshot: (snapshot) => this.setRunningSessions(snapshot),
          onDelta: (status) => this.setSessionRunning(status.id, status.running, status),
          onMessage: (message) => {
            if (message === 'new-session') this.refreshSessions();
            if (message === 'reload') this.scheduleReload();
          }
        });
        this._statusEvents.connect();
      } catch {
        /* EventSource unavailable — page degrades to no live status */
      }
    },

    async setLayout(layout) {
      const next = layout === 'projects' ? 'projects' : 'timeline';
      if (this.layout === next) return;
      this.layout = next;
      await this.refreshSessions();
    },

    filter() {
      filterSessionCards(this.query, root);
    },

    async openModal() {
      this.modal = true;
      this.path = '';
      this.error = '';
      this.recent = [];
      try {
        const response = await fetchRecent();
        this.recent = (response.locations || []).slice(0, 10);
      } catch {
        // Intentional no-op: recent locations are optional.
      }
      return this.recent;
    },

    async loadProjects() {
      const response = await fetchProjects();
      return {
        projects: Array.isArray(response.projects) ? response.projects : [],
        filterEnabled: !!response.filterEnabled
      };
    },

    async setProjectEnabled(path, enabled) {
      await updateProject(path, enabled ? 'enable' : 'disable');
      await this.refreshSessions();
    },

    async setAllProjectsEnabled(enabled) {
      await updateProject('', enabled ? 'enable-all' : 'disable-all');
      await this.refreshSessions();
    },

    async setFilterEnabled(enabled) {
      await updateProject('', enabled ? 'enable-filter' : 'disable-filter');
      await this.refreshSessions();
    },

    async registerProject(path) {
      const p = (path || '').trim();
      if (!p) return false;
      await updateProject(p, 'register');
      await this.refreshSessions();
      return true;
    },

    async removeProject(path) {
      await updateProject(path, 'remove');
      await this.refreshSessions();
    },

    async create() {
      const p = this.path.trim();
      if (!p) {
        this.error = 'Please enter a path';
        return;
      }
      this.creating = true;
      this.error = '';
      try {
        const response = await createSession(p);
        if (response.ok && response.id) {
          navigate('/session?id=' + encodeURIComponent(response.id));
          return;
        }
        this.error = response.error || 'Failed to create session';
      } catch (error) {
        this.error = error.message || 'Network error';
      } finally {
        this.creating = false;
      }
    }
  };
}
