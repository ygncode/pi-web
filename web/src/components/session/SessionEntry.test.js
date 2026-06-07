import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import SessionEntry from './SessionEntry.svelte';

describe('SessionEntry', () => {
  it('renders the HTML produced by renderEntry', () => {
    const renderEntry = (e) => `<div id="entry-${e.id}" class="user-message">${e.text}</div>`;
    const { container } = render(SessionEntry, { props: { entry: { id: 'a', text: 'hello' }, renderEntry } });
    const node = container.querySelector('#entry-a');
    expect(node).toBeInTheDocument();
    expect(node).toHaveClass('user-message');
    expect(node.textContent).toBe('hello');
  });

  it('renders nothing when renderEntry is missing or returns empty', () => {
    const { container } = render(SessionEntry, { props: { entry: { id: 'a' }, renderEntry: null } });
    expect(container.querySelector('#entry-a')).not.toBeInTheDocument();
  });
});
