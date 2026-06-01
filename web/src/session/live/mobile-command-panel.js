import { isDoneNotifyEnabled } from '../chat/done-notifier.js';
import { showModelUsageModal } from './model-usage-modal.js';
import { openVersionModal } from '../../shared/version.js';

export function setupMobileCommandPanel({
  documentImpl = document,
  windowImpl = window,
  setSidebarOpen = null,
  getEntries = null,
  escapeHtml = String,
  formatTokens = String,
} = {}) {
  const backdrop = documentImpl.getElementById('mobile-command-backdrop');
  const panel = documentImpl.getElementById('mobile-command-panel');
  const btn = documentImpl.getElementById('mobile-command-btn');
  if (!backdrop || !panel || !btn) return;

  function openPanel() {
    backdrop.style.display = '';
    panel.style.display = '';
    syncNotifyToggle();
    requestAnimationFrame(() => {
      backdrop.classList.add('open');
      panel.classList.add('open');
    });
    documentImpl.body.style.overflow = 'hidden';
  }

  function closePanel() {
    backdrop.classList.remove('open');
    panel.classList.remove('open');
    windowImpl.setTimeout(() => {
      if (!panel.classList.contains('open')) {
        backdrop.style.display = 'none';
        panel.style.display = 'none';
      }
    }, 260);
    documentImpl.body.style.overflow = '';
  }

  function syncNotifyToggle() {
    const status = documentImpl.getElementById('mobile-command-notify-status');
    if (!status) return;
    const enabled = isDoneNotifyEnabled({ storage: windowImpl.localStorage });
    status.textContent = enabled ? 'ON' : 'OFF';
    status.classList.toggle('on', enabled);
  }

  function showToast(message) {
    let notice = documentImpl.getElementById('mobile-command-toast');
    if (!notice) {
      notice = documentImpl.createElement('div');
      notice.id = 'mobile-command-toast';
      notice.className = 'toast-notice';
      documentImpl.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.classList.add('visible');
    clearTimeout(showToast._timer);
    showToast._timer = windowImpl.setTimeout(() => {
      notice.classList.remove('visible');
    }, 1500);
  }

  btn.addEventListener('click', openPanel);
  backdrop.addEventListener('click', closePanel);

  documentImpl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    }
  });

  panel.addEventListener('click', (e) => {
    const item = e.target.closest('.mobile-command-item');
    if (!item) return;
    const action = item.dataset.action;
    if (!action) return;

    switch (action) {
      case 'theme': {
        const themeBtn = documentImpl.getElementById('theme-toggle');
        if (themeBtn) themeBtn.click();
        closePanel();
        break;
      }
      case 'notifications': {
        const notifyBtn = documentImpl.getElementById('notify-toggle');
        if (notifyBtn) notifyBtn.click();
        syncNotifyToggle();
        windowImpl.setTimeout(syncNotifyToggle, 400);
        break;
      }
      case 'share': {
        const shareBtn = documentImpl.getElementById('share-btn');
        if (shareBtn) shareBtn.click();
        closePanel();
        break;
      }
      case 'new-session': {
        const newBtn = documentImpl.getElementById('new-btn');
        if (newBtn) newBtn.click();
        closePanel();
        break;
      }
      case 'terminal': {
        const resumeBtn = documentImpl.getElementById('resume-btn');
        if (resumeBtn) resumeBtn.click();
        closePanel();
        break;
      }
      case 'tree': {
        if (setSidebarOpen) setSidebarOpen(true);
        closePanel();
        break;
      }
      case 'model-usage': {
        if (getEntries) {
          showModelUsageModal({
            entries: getEntries(),
            escapeHtml,
            formatTokens,
            documentImpl,
          });
        }
        closePanel();
        break;
      }
      case 'version':
        closePanel();
        openVersionModal();
        break;
      case 'rename':
      case 'fork':
      case 'clone':
      case 'diff':
        showToast('Not yet implemented');
        break;
      default:
        break;
    }
  });
}
