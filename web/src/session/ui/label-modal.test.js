import { afterEach, describe, expect, it, vi } from 'vitest';
import { openLabelModal } from './label-modal.js';

describe('label modal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  it('saves the typed label', () => {
    const onSave = vi.fn();
    openLabelModal({ entryId: 'e1', currentLabel: '', onSave, documentImpl: document });
    const input = document.getElementById('label-modal-input');
    input.value = 'Checkpoint';
    document.querySelector('.label-modal-save').click();
    expect(onSave).toHaveBeenCalledWith({ entryId: 'e1', label: 'Checkpoint' });
    expect(document.getElementById('label-modal-backdrop')).toBeNull();
  });

  it('shows remove for existing labels and clears the label', () => {
    const onSave = vi.fn();
    openLabelModal({ entryId: 'e1', currentLabel: 'Old', onSave, documentImpl: document });
    const remove = document.querySelector('.label-modal-remove');
    expect(remove.hidden).toBe(false);
    remove.click();
    expect(onSave).toHaveBeenCalledWith({ entryId: 'e1', label: '' });
  });

  it('hides remove when there is no existing label', () => {
    openLabelModal({ entryId: 'e1', currentLabel: '', onSave: vi.fn(), documentImpl: document });
    expect(document.querySelector('.label-modal-remove').hidden).toBe(true);
  });
});
