import { afterEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ShortcutsModal from './ShortcutsModal.svelte';

afterEach(cleanup);

describe('ShortcutsModal (over FullScreenSheet)', () => {
  it('renders the sheet dialog with all shortcut groups when open', async () => {
    render(ShortcutsModal, { props: { open: true } });
    await tick();
    const panel = document.querySelector('.pi-sheet-panel');
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelectorAll('.shortcuts-group').length).toBe(3);
    expect(document.querySelectorAll('.shortcuts-item').length).toBeGreaterThan(5);
  });

  it('filters shortcuts by search query (empty state when nothing matches)', async () => {
    const user = userEvent.setup();
    render(ShortcutsModal, { props: { open: true } });
    await tick();
    const input = document.querySelector('.shortcuts-search-input');
    const before = document.querySelectorAll('.shortcuts-item').length;
    expect(before).toBeGreaterThan(0);

    await user.type(input, 'zzzznomatch');
    await tick();
    expect(document.querySelectorAll('.shortcuts-item').length).toBe(0);
    expect(document.querySelector('.shortcuts-empty-state')).toBeTruthy();
  });

  it('closes (unmounts the sheet) on Escape', async () => {
    render(ShortcutsModal, { props: { open: true } });
    await tick();
    expect(document.querySelector('.pi-sheet-panel')).toBeTruthy();

    await fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(document.querySelector('.pi-sheet-panel')).toBeFalsy();
    });
  });
});
