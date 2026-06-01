import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createSessionsPage } from './sessions-page.js';

function mountSessionCards() {
  document.body.innerHTML = `
    <div class="project-group">
      <div class="session-card" data-session-id="alpha.jsonl" data-search="alpha project"><div data-session-model></div><span data-running-model></span></div>
      <div class="session-card" data-session-id="beta.jsonl" data-search="beta project"><div data-session-model></div><span data-running-model></span></div>
    </div>
    <div class="project-group">
      <div class="session-card" data-session-id="gamma.jsonl" data-search="gamma other"><div data-session-model></div><span data-running-model></span></div>
    </div>
  `;
}

describe('createSessionsPage scalable state', () => {
  beforeEach(() => {
    mountSessionCards();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('filters cards and hides empty project groups through a testable DOM boundary', () => {
    const page = createSessionsPage();
    page.query = 'other';

    page.filter();

    expect(document.querySelector('[data-session-id="alpha.jsonl"]').classList.contains('hidden')).toBe(true);
    expect(document.querySelector('[data-session-id="gamma.jsonl"]').classList.contains('hidden')).toBe(false);
    expect(document.querySelectorAll('.project-group')[0].style.display).toBe('none');
    expect(document.querySelectorAll('.project-group')[1].style.display).toBe('');
  });

  it('tracks running sessions independently of the DOM', () => {
    const page = createSessionsPage();

    page.setRunningSessions(['alpha.jsonl']);
    expect(page.isSessionRunning('alpha.jsonl')).toBe(true);
    expect(document.querySelector('[data-session-id="alpha.jsonl"]').classList.contains('session-card--running')).toBe(true);

    page.setSessionRunning('alpha.jsonl', false);
    expect(page.isSessionRunning('alpha.jsonl')).toBe(false);
    expect(document.querySelector('[data-session-id="alpha.jsonl"]').classList.contains('session-card--running')).toBe(false);
  });

  it('renders model/provider from status snapshots and deltas', () => {
    const page = createSessionsPage();

    page.setRunningSessions({
      ids: ['alpha.jsonl'],
      statuses: { 'alpha.jsonl': { modelProvider: 'deepseek', model: 'deepseek-v4-pro' } }
    });
    expect(document.querySelector('[data-session-id="alpha.jsonl"] [data-session-model]').textContent).toBe('deepseek/deepseek-v4-pro');
    expect(document.querySelector('[data-session-id="alpha.jsonl"] [data-running-model]').textContent).toBe('deepseek/deepseek-v4-pro');

    page.setSessionRunning('beta.jsonl', true, { modelProvider: 'anthropic', modelName: 'Claude Sonnet 4.5', model: 'claude-sonnet-4-5' });
    expect(document.querySelector('[data-session-id="beta.jsonl"] [data-session-model]').textContent).toBe('anthropic/Claude Sonnet 4.5');
  });

  it('switches between timeline project runs and consolidated project groups', async () => {
    document.body.innerHTML = '<div data-sessions-content></div>';
    const fetchSessions = vi.fn(() => Promise.resolve({ sessions: [
      { id: 'a-old.jsonl', name: 'A Old', project: '/a', lastActivity: '2026-01-01T00:00:00Z' },
      { id: 'b-mid.jsonl', name: 'B Mid', project: '/b', lastActivity: '2026-01-02T00:00:00Z' },
      { id: 'a-new.jsonl', name: 'A New', project: '/a', lastActivity: '2026-01-03T00:00:00Z' },
    ] }));
    const page = createSessionsPage({ fetchSessions });

    await page.refreshSessions();

    expect(document.querySelector('[data-sessions-content]').classList.contains('content--timeline')).toBe(true);
    expect(Array.from(document.querySelectorAll('.project-group')).map((el) => el.dataset.project)).toEqual(['/a', '/b', '/a']);
    expect(Array.from(document.querySelectorAll('.session-card')).map((el) => el.dataset.sessionId)).toEqual(['a-new.jsonl', 'b-mid.jsonl', 'a-old.jsonl']);

    await page.setLayout('projects');

    expect(document.querySelector('[data-sessions-content]').classList.contains('content--timeline')).toBe(false);
    expect(Array.from(document.querySelectorAll('.project-group')).map((el) => el.dataset.project)).toEqual(['/a', '/b']);
  });

  it('wires subscription callbacks without exposing EventSource details to page state', () => {
    const connect = vi.fn();
    const cleanup = vi.fn();
    const createStatusEvents = vi.fn((options) => {
      options.onSnapshot(['beta.jsonl']);
      options.onDelta({ id: 'gamma.jsonl', running: true });
      options.onMessage('new-session');
      return { connect, cleanup };
    });
    document.body.innerHTML = '<div data-sessions-content></div>';
    const fetchSessions = vi.fn(() => Promise.resolve({ sessions: [] }));

    const page = createSessionsPage({ createStatusEvents, fetchSessions });
    page.subscribe();

    expect(createStatusEvents).toHaveBeenCalledWith(expect.objectContaining({
      onSnapshot: expect.any(Function),
      onDelta: expect.any(Function),
      onMessage: expect.any(Function)
    }));
    expect(connect).toHaveBeenCalled();
    expect(fetchSessions).toHaveBeenCalled();
    expect(page.isSessionRunning('beta.jsonl')).toBe(true);
    expect(page.isSessionRunning('gamma.jsonl')).toBe(true);

    page.cleanup();
    expect(cleanup).toHaveBeenCalled();
  });

  it('debounces reload on session file change messages', () => {
    const timers = [];
    const setTimeoutImpl = vi.fn((fn, ms) => {
      const id = timers.length + 1;
      timers.push({ id, fn, ms });
      return id;
    });
    const clearTimeoutImpl = vi.fn((id) => {
      const idx = timers.findIndex(t => t.id === id);
      if (idx !== -1) timers.splice(idx, 1);
    });
    const fetchSessions = vi.fn(() => Promise.resolve({ sessions: [] }));

    let onMessageHandler;
    const createStatusEvents = vi.fn((options) => {
      onMessageHandler = options.onMessage;
      return { connect: vi.fn(), cleanup: vi.fn() };
    });

    const page = createSessionsPage({ createStatusEvents, fetchSessions, setTimeoutImpl, clearTimeoutImpl });
    page.subscribe();

    onMessageHandler('reload');
    expect(timers.length).toBe(1);
    expect(timers[0].ms).toBe(500);
    expect(fetchSessions).not.toHaveBeenCalled();

    // Fire the timer
    timers[0].fn();
    expect(fetchSessions).toHaveBeenCalledTimes(1);
  });

  it('resets reload debounce when multiple reload messages arrive', () => {
    const timers = [];
    let nextId = 1;
    const setTimeoutImpl = vi.fn((fn, ms) => {
      const id = nextId++;
      timers.push({ id, fn, ms });
      return id;
    });
    const clearTimeoutImpl = vi.fn((id) => {
      const idx = timers.findIndex(t => t.id === id);
      if (idx !== -1) timers.splice(idx, 1);
    });
    const reload = vi.fn();

    let onMessageHandler;
    const createStatusEvents = vi.fn((options) => {
      onMessageHandler = options.onMessage;
      return { connect: vi.fn(), cleanup: vi.fn() };
    });

    const page = createSessionsPage({ createStatusEvents, reload, setTimeoutImpl, clearTimeoutImpl });
    page.subscribe();

    onMessageHandler('reload');
    expect(timers.length).toBe(1);
    const firstId = timers[0].id;

    onMessageHandler('reload');
    expect(clearTimeoutImpl).toHaveBeenCalledWith(firstId);
    expect(timers.length).toBe(1); // old removed, new added
    expect(timers[0].id).toBeGreaterThan(firstId);
  });

  it('does not schedule reload while modal is open or search is active', () => {
    const setTimeoutImpl = vi.fn();
    const clearTimeoutImpl = vi.fn();
    const reload = vi.fn();

    let onMessageHandler;
    const createStatusEvents = vi.fn((options) => {
      onMessageHandler = options.onMessage;
      return { connect: vi.fn(), cleanup: vi.fn() };
    });

    const page = createSessionsPage({ createStatusEvents, reload, setTimeoutImpl, clearTimeoutImpl });
    page.subscribe();

    page.modal = true;
    onMessageHandler('reload');
    expect(setTimeoutImpl).not.toHaveBeenCalled();

    page.modal = false;
    page.query = 'searching';
    onMessageHandler('reload');
    expect(setTimeoutImpl).not.toHaveBeenCalled();

    page.query = '';
    onMessageHandler('reload');
    expect(setTimeoutImpl).toHaveBeenCalledTimes(1);
  });

  it('cancels pending reload on cleanup', () => {
    const timers = [];
    const setTimeoutImpl = vi.fn((fn, ms) => {
      const id = timers.length + 1;
      timers.push({ id, fn, ms });
      return id;
    });
    const clearTimeoutImpl = vi.fn();
    const reload = vi.fn();

    let onMessageHandler;
    const createStatusEvents = vi.fn((options) => {
      onMessageHandler = options.onMessage;
      return { connect: vi.fn(), cleanup: vi.fn() };
    });

    const page = createSessionsPage({ createStatusEvents, reload, setTimeoutImpl, clearTimeoutImpl });
    page.subscribe();

    onMessageHandler('reload');
    expect(timers.length).toBe(1);

    page.cleanup();
    expect(clearTimeoutImpl).toHaveBeenCalledWith(timers[0].id);
    expect(page._reloadTimer).toBeNull();
  });
});

describe('createSessionsPage project management', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('loads projects and filter state from the API', async () => {
    const fetchProjects = vi.fn(async () => ({
      filterEnabled: true,
      projects: [
        { path: '/a', enabled: true, sessionCount: 2, source: 'discovered' },
        { path: '/b', enabled: false, sessionCount: 0, source: 'registered' }
      ]
    }));
    const page = createSessionsPage({ fetchProjects });
    const { projects, filterEnabled } = await page.loadProjects();
    expect(projects).toHaveLength(2);
    expect(projects[0].path).toBe('/a');
    expect(filterEnabled).toBe(true);
  });

  it('toggles the project filter mode then refreshes', async () => {
    const updateProject = vi.fn(async () => ({ ok: true }));
    const fetchSessions = vi.fn(async () => ({ sessions: [] }));
    const page = createSessionsPage({ updateProject, fetchSessions });

    await page.setFilterEnabled(true);
    expect(updateProject).toHaveBeenCalledWith('', 'enable-filter');
    await page.setFilterEnabled(false);
    expect(updateProject).toHaveBeenCalledWith('', 'disable-filter');
    expect(fetchSessions).toHaveBeenCalledTimes(2);
  });

  it('toggles a project then refreshes the session list', async () => {
    const updateProject = vi.fn(async () => ({ ok: true }));
    const fetchSessions = vi.fn(async () => ({ sessions: [] }));
    const page = createSessionsPage({ updateProject, fetchSessions });

    await page.setProjectEnabled('/a', false);
    expect(updateProject).toHaveBeenCalledWith('/a', 'disable');
    expect(fetchSessions).toHaveBeenCalled();

    await page.setProjectEnabled('/a', true);
    expect(updateProject).toHaveBeenCalledWith('/a', 'enable');
  });

  it('registers a project and ignores blank paths', async () => {
    const updateProject = vi.fn(async () => ({ ok: true }));
    const fetchSessions = vi.fn(async () => ({ sessions: [] }));
    const page = createSessionsPage({ updateProject, fetchSessions });

    const ok = await page.registerProject('  ~/proj  ');
    expect(ok).toBe(true);
    expect(updateProject).toHaveBeenCalledWith('~/proj', 'register');

    updateProject.mockClear();
    const blank = await page.registerProject('   ');
    expect(blank).toBe(false);
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('removes a project then refreshes', async () => {
    const updateProject = vi.fn(async () => ({ ok: true }));
    const fetchSessions = vi.fn(async () => ({ sessions: [] }));
    const page = createSessionsPage({ updateProject, fetchSessions });

    await page.removeProject('/b');
    expect(updateProject).toHaveBeenCalledWith('/b', 'remove');
    expect(fetchSessions).toHaveBeenCalled();
  });

  it('enables/disables all projects then refreshes', async () => {
    const updateProject = vi.fn(async () => ({ ok: true }));
    const fetchSessions = vi.fn(async () => ({ sessions: [] }));
    const page = createSessionsPage({ updateProject, fetchSessions });

    await page.setAllProjectsEnabled(false);
    expect(updateProject).toHaveBeenCalledWith('', 'disable-all');
    await page.setAllProjectsEnabled(true);
    expect(updateProject).toHaveBeenCalledWith('', 'enable-all');
    expect(fetchSessions).toHaveBeenCalledTimes(2);
  });
});
