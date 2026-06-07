import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup } from '@testing-library/svelte';
import LabelModal from './LabelModal.svelte';

afterEach(cleanup);

describe('LabelModal', () => {
  it('saves the typed label and closes', async () => {
    const onSave = vi.fn();
    render(LabelModal, { props: { open: true, entryId: 'e1', currentLabel: '', onSave } });
    await tick();
    const input = document.getElementById('label-modal-input');
    input.value = 'Checkpoint';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    document.querySelector('.label-modal-save').click();
    await tick();
    expect(onSave).toHaveBeenCalledWith({ entryId: 'e1', label: 'Checkpoint' });
    expect(document.getElementById('label-modal-backdrop')).toBeNull();
  });

  it('shows remove for existing labels and clears the label', async () => {
    const onSave = vi.fn();
    render(LabelModal, { props: { open: true, entryId: 'e1', currentLabel: 'Old', onSave } });
    await tick();
    const remove = document.querySelector('.label-modal-remove');
    expect(remove.hidden).toBe(false);
    remove.click();
    await tick();
    expect(onSave).toHaveBeenCalledWith({ entryId: 'e1', label: '' });
  });

  it('hides remove when there is no existing label', async () => {
    render(LabelModal, { props: { open: true, entryId: 'e1', currentLabel: '', onSave: vi.fn() } });
    await tick();
    expect(document.querySelector('.label-modal-remove').hidden).toBe(true);
  });
});
