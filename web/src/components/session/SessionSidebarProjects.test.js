import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SessionSidebarProjects from './SessionSidebarProjects.svelte';

function session(id, name, project) {
  return {
    ID: id,
    Name: name,
    Project: project,
  };
}

describe('SessionSidebarProjects', () => {
  it('starts with the current project expanded and other projects collapsed', async () => {
    const fetchProjects = vi.fn().mockResolvedValue({
      projects: [
        {
          path: '/repo/other',
          sessionCount: 2,
        },
        {
          path: '/repo/pi-web',
          sessionCount: 7,
        },
      ],
    });
    const fetchSessions = vi.fn().mockResolvedValue({
      sessions: [
        session('current.jsonl', 'Review recent changes', '/repo/pi-web'),
        session('two.jsonl', 'Second session', '/repo/pi-web'),
        session('three.jsonl', 'Third session', '/repo/pi-web'),
        session('four.jsonl', 'Fourth session', '/repo/pi-web'),
        session('five.jsonl', 'Fifth session', '/repo/pi-web'),
      ],
      total: 7,
    });

    const { container } = render(SessionSidebarProjects, {
      props: {
        cwd: '/repo/pi-web',
        currentSessionId: 'current.jsonl',
        fetchProjects,
        fetchSessions,
      },
    });

    expect(await screen.findByRole('link', { name: /Review recent changes/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: /pi-web/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /other/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('2 / 2 projects')).toBeInTheDocument();
    expect(fetchProjects).toHaveBeenCalledOnce();
    expect(fetchProjects).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      currentProject: '/repo/pi-web',
      currentSessionLimit: 5,
      filtered: true,
    });
    expect(fetchSessions).toHaveBeenCalledWith({
      project: '/repo/pi-web',
      limit: 5,
      offset: 0,
    });

    const headings = [...container.querySelectorAll('.sidebar-project-title')].map(
      (heading) => heading.textContent,
    );
    expect(headings).toEqual(['pi-web', 'other']);
    expect(container.querySelector('.sidebar-session-indicator')).toBeInTheDocument();
  });

  it('loads five more sessions when an expanded project list reaches the bottom', async () => {
    const fetchProjects = vi.fn().mockResolvedValue({
      projects: [{ path: '/repo/pi-web', sessionCount: 7 }],
    });
    const firstPage = Array.from({ length: 5 }, (_, index) =>
      session(`${index + 1}.jsonl`, `Session ${index + 1}`, '/repo/pi-web'),
    );
    const fetchSessions = vi
      .fn()
      .mockResolvedValueOnce({ sessions: firstPage, total: 7 })
      .mockResolvedValueOnce({
        sessions: [
          session('6.jsonl', 'Session 6', '/repo/pi-web'),
          session('7.jsonl', 'Session 7', '/repo/pi-web'),
        ],
        total: 7,
      });

    render(SessionSidebarProjects, {
      props: {
        cwd: '/repo/pi-web',
        fetchProjects,
        fetchSessions,
      },
    });

    const list = await screen.findByRole('region', { name: 'pi-web sessions' });
    await waitFor(() => {
      expect(within(list).getAllByRole('link')).toHaveLength(5);
    });
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 184 },
      scrollHeight: { configurable: true, value: 360 },
      scrollTop: { configurable: true, value: 176 },
    });
    await fireEvent.scroll(list);

    expect(await within(list).findByRole('link', { name: 'Session 7' })).toBeInTheDocument();
    expect(fetchSessions).toHaveBeenLastCalledWith({
      project: '/repo/pi-web',
      limit: 5,
      offset: 5,
    });
  });

  it('loads a collapsed project on demand and can collapse it again', async () => {
    const user = userEvent.setup();
    const fetchProjects = vi.fn().mockResolvedValue({
      projects: [{ path: '/repo/other', sessionCount: 1 }],
    });
    const fetchSessions = vi.fn().mockResolvedValue({
      sessions: [session('other.jsonl', 'Other project session', '/repo/other')],
      total: 1,
    });

    render(SessionSidebarProjects, {
      props: {
        cwd: '/repo/pi-web',
        fetchProjects,
        fetchSessions,
      },
    });

    const projectButton = await screen.findByRole('button', { name: /other/ });
    expect(projectButton).toHaveAttribute('aria-expanded', 'false');
    expect(fetchSessions).not.toHaveBeenCalled();

    await user.click(projectButton);
    expect(await screen.findByRole('link', { name: 'Other project session' })).toBeInTheDocument();
    expect(projectButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(projectButton);
    expect(projectButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Other project session' })).not.toBeInTheDocument();
  });

  it('loads twenty more projects when the main project list reaches the bottom', async () => {
    const firstProjects = [
      { path: '/repo/current', sessionCount: 0 },
      ...Array.from({ length: 19 }, (_, index) => ({
        path: `/repo/project-${index + 1}`,
        sessionCount: 0,
      })),
    ];
    const nextProjects = Array.from({ length: 5 }, (_, index) => ({
      path: `/repo/project-${index + 20}`,
      sessionCount: 0,
    }));
    const fetchProjects = vi
      .fn()
      .mockResolvedValueOnce({ projects: firstProjects, total: 25 })
      .mockResolvedValueOnce({ projects: nextProjects, total: 25 });
    const fetchSessions = vi.fn().mockResolvedValue({ sessions: [], total: 0 });

    const { container } = render(SessionSidebarProjects, {
      props: {
        cwd: '/repo/current',
        fetchProjects,
        fetchSessions,
      },
    });

    expect(await screen.findByText('20 / 25 projects')).toBeInTheDocument();
    const list = container.querySelector('.sidebar-projects-list');
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 600 },
      scrollHeight: { configurable: true, value: 1200 },
      scrollTop: { configurable: true, value: 600 },
    });
    await fireEvent.scroll(list);

    expect(await screen.findByRole('button', { name: /project-24/ })).toBeInTheDocument();
    expect(screen.getByText('25 / 25 projects')).toBeInTheDocument();
    expect(fetchProjects).toHaveBeenLastCalledWith({
      limit: 20,
      offset: 20,
      currentProject: '/repo/current',
      currentSessionLimit: 5,
      filtered: true,
    });
  });

  it('offers a retry when loading more projects is interrupted', async () => {
    const firstProjects = Array.from({ length: 20 }, (_, index) => ({
      path: `/repo/project-${index}`,
      sessionCount: 0,
    }));
    const fetchProjects = vi
      .fn()
      .mockResolvedValueOnce({ projects: firstProjects, total: 21 })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        projects: [{ path: '/repo/project-20', sessionCount: 0 }],
        total: 21,
      });

    const { container } = render(SessionSidebarProjects, {
      props: {
        cwd: '/repo/current',
        fetchProjects,
        fetchSessions: vi.fn(),
      },
    });

    expect(await screen.findByText('20 / 21 projects')).toBeInTheDocument();
    const list = container.querySelector('.sidebar-projects-list');
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 600 },
      scrollHeight: { configurable: true, value: 1200 },
      scrollTop: { configurable: true, value: 600 },
    });
    await fireEvent.scroll(list);

    const retry = await screen.findByRole('button', {
      name: "Couldn't load more projects. Retry",
    });
    expect(retry).toHaveAttribute('title', 'Failed to fetch');
    expect(fetchProjects).toHaveBeenCalledTimes(3);
    await userEvent.click(retry);

    expect(await screen.findByRole('button', { name: /project-20/ })).toBeInTheDocument();
    expect(screen.getByText('21 / 21 projects')).toBeInTheDocument();
    expect(fetchProjects).toHaveBeenCalledTimes(4);
  });

  it('uses sessions bundled with the first project page for the current project', async () => {
    const fetchProjects = vi.fn().mockResolvedValue({
      projects: [{ path: '/repo/pi-web', sessionCount: 8 }],
      total: 1,
      currentSessions: [
        session('current.jsonl', 'Bundled current session', '/repo/pi-web'),
        session('second.jsonl', 'Bundled second session', '/repo/pi-web'),
      ],
      currentSessionsTotal: 8,
    });
    const fetchSessions = vi.fn();

    render(SessionSidebarProjects, {
      props: {
        cwd: '/repo/pi-web',
        currentSessionId: 'current.jsonl',
        fetchProjects,
        fetchSessions,
      },
    });

    expect(await screen.findByRole('link', { name: 'Bundled current session' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Bundled second session' })).toBeInTheDocument();
    expect(fetchSessions).not.toHaveBeenCalled();
  });

  it('shows a running indicator on a collapsed project with an active session', async () => {
    const fetchProjects = vi.fn().mockResolvedValue({
      projects: [
        {
          path: '/repo/other',
          sessionCount: 8,
          runningSessionIds: ['active.jsonl'],
        },
      ],
      total: 1,
    });

    render(SessionSidebarProjects, {
      props: {
        cwd: '/repo/pi-web',
        fetchProjects,
        fetchSessions: vi.fn(),
        runningSessionIds: new Set(['active.jsonl']),
      },
    });

    const indicator = await screen.findByLabelText('Project has an active session');
    const projectButton = screen.getByRole('button', { name: /other/ });
    expect(indicator).toBe(projectButton.lastElementChild);
    expect(projectButton).toHaveAttribute('aria-expanded', 'false');
  });
});
