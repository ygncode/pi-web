import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import CatGatekeeperSettings from './CatGatekeeperSettings.svelte';
import { loadCatSettings } from '../../session/cat-gatekeeper/cat-settings.js';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('CatGatekeeperSettings', () => {
  it('renders the form with defaults and persists the enable toggle', async () => {
    render(CatGatekeeperSettings, { props: { open: true } });
    await tick();
    const toggle = document.querySelector('.cat-settings-toggle');
    expect(toggle.checked).toBe(true);

    await fireEvent.change(toggle, { target: { checked: false } });
    expect(loadCatSettings({ storage: localStorage }).enabled).toBe(false);
  });

  it('persists a clamped number field', async () => {
    render(CatGatekeeperSettings, { props: { open: true } });
    await tick();
    const focus = document.querySelector('input[type="number"]');
    await fireEvent.change(focus, { target: { value: '9999' } });
    expect(loadCatSettings({ storage: localStorage }).focusMin).toBe(240); // clamped to max
  });

  it('shows the live status row + skip button when a controller is provided', async () => {
    const controller = { getStatusText: () => 'Next break in 5m', skipToBreak: vi.fn() };
    render(CatGatekeeperSettings, { props: { open: true, controller } });
    await tick();
    expect(document.querySelector('.cat-settings-status-text').textContent).toContain('Next break in 5m');
    await fireEvent.click(document.querySelector('.cat-settings-skip'));
    expect(controller.skipToBreak).toHaveBeenCalled();
  });
});
