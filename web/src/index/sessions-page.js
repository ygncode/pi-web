import { getJSON, postJSON } from '../shared/api.js';
import { createStatusEvents as defaultCreateStatusEvents } from '../shared/status-events.js';

function defaultReload() {
  window.location.reload();
}

function defaultNavigate(url) {
  window.location = url;
}

function sessionCards(root = document) {
  return Array.from(root.querySelectorAll('.session-card[data-session-id]'));
}

function syncRunningCardClasses(runningSessionIds, root = document) {
  sessionCards(root).forEach((card) => {
    const id = card.dataset.sessionId;
    card.classList.toggle('session-card--running', !!id && runningSessionIds.has(id));
  });
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
  createSession = (path) => postJSON('/api/new-session', { path }),
  createStatusEvents = defaultCreateStatusEvents,
  reload = defaultReload,
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
    runningSessionIds: new Set(),
    _statusEvents: null,
    _reloadTimer: null,

    sessionCards() {
      return sessionCards(root);
    },

    syncRunningCardClasses() {
      syncRunningCardClasses(this.runningSessionIds, root);
    },

    isSessionRunning(id) {
      return this.runningSessionIds.has(id);
    },

    setRunningSessions(ids) {
      this.runningSessionIds = new Set(Array.isArray(ids) ? ids : []);
      this.syncRunningCardClasses();
    },

    setSessionRunning(id, running) {
      if (running) this.runningSessionIds.add(id);
      else this.runningSessionIds.delete(id);
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

    scheduleReload() {
      if (this._reloadTimer) {
        clearTimeoutImpl(this._reloadTimer);
        this._reloadTimer = null;
      }
      if (this.modal) return;
      if (this.query && this.query.trim() !== '') return;
      this._reloadTimer = setTimeoutImpl(() => {
        this._reloadTimer = null;
        reload();
      }, 5000);
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
          onSnapshot: (ids) => this.setRunningSessions(ids),
          onDelta: ({ id, running }) => this.setSessionRunning(id, running),
          onMessage: (message) => {
            if (message === 'new-session') reload();
            if (message === 'reload') this.scheduleReload();
          }
        });
        this._statusEvents.connect();
      } catch {
        /* EventSource unavailable — page degrades to no live status */
      }
    },

    filter() {
      filterSessionCards(this.query, root);
    },

    async openModal() {
      this.modal = true;
      this.path = '';
      this.error = '';
      this.recent = [];
      this.$nextTick?.(() => this.$refs.sessionPath.focus());
      try {
        const response = await fetchRecent();
        this.recent = (response.locations || []).slice(0, 10);
      } catch {
        // Intentional no-op: recent locations are optional.
      }
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
