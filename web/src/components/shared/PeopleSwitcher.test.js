import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import PeopleSwitcher from './PeopleSwitcher.svelte';
import SessionOwnerBadge from './SessionOwnerBadge.svelte';

const people = {
  multiUser: true,
  view: 'me',
  me: { login: 'ana@symetrix.com', short: 'ana', name: 'Ana' },
  people: [
    { login: 'ana@symetrix.com', short: 'ana', me: true, sessions: 3 },
    { login: 'bruno@symetrix.com', short: 'bruno', sessions: 5 },
  ],
  unassigned: 2,
  total: 10,
};

afterEach(() => {
  document.cookie = 'pi_view_owner=; Path=/; Max-Age=0';
});

describe('PeopleSwitcher', () => {
  it('renders nothing on single-user installs', async () => {
    const load = vi.fn().mockResolvedValue({ multiUser: false });
    const { container } = render(PeopleSwitcher, { props: { load } });
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(container.querySelector('.people-switcher')).toBeNull();
  });

  it('defaults to my sessions and switches to a colleague', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const { container, getByText } = render(PeopleSwitcher, {
      props: { load: () => Promise.resolve(people), reload },
    });
    await waitFor(() => expect(getByText('Minhas conversas')).toBeTruthy());
    await user.click(container.querySelector('.people-switcher-btn'));
    expect(getByText('Bruno')).toBeTruthy();
    expect(getByText('Sem dono')).toBeTruthy();
    await user.click(getByText('Bruno'));
    expect(document.cookie).toContain('pi_view_owner=bruno%40symetrix.com');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('highlights when browsing someone else', async () => {
    const { container, getByText } = render(PeopleSwitcher, {
      props: { load: () => Promise.resolve({ ...people, view: 'bruno@symetrix.com' }) },
    });
    await waitFor(() => expect(getByText('Conversas de Bruno')).toBeTruthy());
    expect(container.querySelector('.people-switcher.others')).toBeTruthy();
  });
});

describe('SessionOwnerBadge', () => {
  it("shows the owner of a colleague's session", async () => {
    const load = vi.fn().mockResolvedValue({
      multiUser: true,
      owner: 'bruno@symetrix.com',
      short: 'bruno',
      mine: false,
      source: 'claude-code',
    });
    const { getByText, container } = render(SessionOwnerBadge, {
      props: { sessionId: 'b1.jsonl', load },
    });
    await waitFor(() => expect(getByText('de Bruno')).toBeTruthy());
    expect(load).toHaveBeenCalledWith('b1.jsonl');
    expect(container.querySelector('.session-owner-badge.others')).toBeTruthy();
  });

  it('is hidden on single-user installs', async () => {
    const load = vi.fn().mockResolvedValue({ multiUser: false });
    const { container } = render(SessionOwnerBadge, { props: { sessionId: 'x', load } });
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(container.querySelector('.session-owner-badge')).toBeNull();
  });
});
