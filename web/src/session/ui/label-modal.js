import { t } from '../../shared/i18n.js';

export function openLabelModal({
  entryId,
  currentLabel = '',
  onSave,
  documentImpl = document,
} = {}) {
  if (!entryId) return null;

  const existing = documentImpl.getElementById('label-modal-backdrop');
  if (existing) existing.remove();

  const backdrop = documentImpl.createElement('div');
  backdrop.id = 'label-modal-backdrop';
  backdrop.className = 'label-modal-backdrop';
  backdrop.innerHTML = `
    <div class="label-modal" role="dialog" aria-modal="true" aria-labelledby="label-modal-title">
      <h3 id="label-modal-title">${t('session.labelEntry')}</h3>
      <label class="label-modal-field">
        <span>${t('session.labelInput')}</span>
        <input id="label-modal-input" type="text" autocomplete="off" spellcheck="false">
      </label>
      <div class="label-modal-actions">
        <button type="button" class="label-modal-remove">${t('session.removeLabel')}</button>
        <span class="label-modal-spacer"></span>
        <button type="button" class="label-modal-cancel">${t('common.cancel')}</button>
        <button type="button" class="label-modal-save">${t('common.save')}</button>
      </div>
    </div>
  `;

  const input = backdrop.querySelector('#label-modal-input');
  const removeBtn = backdrop.querySelector('.label-modal-remove');
  const cancelBtn = backdrop.querySelector('.label-modal-cancel');
  const saveBtn = backdrop.querySelector('.label-modal-save');

  input.value = currentLabel || '';
  removeBtn.hidden = !currentLabel;

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    backdrop.remove();
  }

  function submit(label) {
    onSave?.({ entryId, label });
    close();
  }

  saveBtn.addEventListener('click', () => submit(input.value.trim()));
  removeBtn.addEventListener('click', () => submit(''));
  cancelBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submit(input.value.trim());
    }
  });

  documentImpl.body.appendChild(backdrop);
  input.focus();
  input.select();

  return { close, element: backdrop, input };
}
