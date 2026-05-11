import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createSessionsPage } from './sessions-page.js';

function mountSessionCards() {
  document.body.innerHTML = `
    <div class="project-group">
      <div class="session-card" data-session-id="alpha.jsonl" data-search="alpha project"></div>
      <div class="session-card" data-session-id="beta.jsonl" data-search="beta project"></div>
    </div>
    <div class="project-group">
      <div class="session-card" data-session-id="gamma.jsonl" data-search="gamma other"></div>
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

  it('wires subscription callbacks without exposing EventSource details to page state', () => {
    const connect = vi.fn();
    const cleanup = vi.fn();
    const createStatusEvents = vi.fn((options) => {
      options.onSnapshot(['beta.jsonl']);
      options.onDelta({ id: 'gamma.jsonl', running: true });
      options.onMessage('new-session');
      return { connect, cleanup };
    });
    const reload = vi.fn();

    const page = createSessionsPage({ createStatusEvents, reload });
    page.subscribe();

    expect(createStatusEvents).toHaveBeenCalledWith(expect.objectContaining({
      onSnapshot: expect.any(Function),
      onDelta: expect.any(Function),
      onMessage: expect.any(Function)
    }));
    expect(connect).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
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
    expect(timers[0].ms).toBe(5000);
    expect(reload).not.toHaveBeenCalled();

    // Fire the timer
    timers[0].fn();
    expect(reload).toHaveBeenCalledTimes(1);
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
