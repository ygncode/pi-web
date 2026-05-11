export function showResumeCopiedNotice(command, state, { documentImpl = document, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  let notice = documentImpl.getElementById('resume-copy-notice');
  if (!notice) {
    notice = documentImpl.createElement('div');
    notice.id = 'resume-copy-notice';
    notice.style.cssText = 'position:fixed;top:8px;right:8px;z-index:200;padding:2px 8px;font-size:10px;font-family:inherit;background:var(--accent);color:var(--body-bg);border-radius:3px;opacity:0;transition:opacity 0.3s;';
    documentImpl.body.appendChild(notice);
  }
  notice.textContent = 'Copied';
  notice.title = command;
  clearTimeoutImpl(state.hideTimer);
  notice.style.opacity = '1';
  state.hideTimer = setTimeoutImpl(() => {
    notice.style.opacity = '0';
  }, 1200);
}

export function copyText(text, onCopied, { documentImpl = document, navigatorImpl = navigator } = {}) {
  function fallbackCopy() {
    const textarea = documentImpl.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    documentImpl.body.appendChild(textarea);
    textarea.select();
    const ok = documentImpl.execCommand('copy');
    documentImpl.body.removeChild(textarea);
    if (ok) onCopied();
  }
  if (navigatorImpl.clipboard && navigatorImpl.clipboard.writeText) {
    navigatorImpl.clipboard.writeText(text).then(onCopied).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

export function setupResumeButton({ documentImpl = document, navigatorImpl = navigator, state = {}, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  const resumeBtn = documentImpl.getElementById('resume-btn');
  if (!resumeBtn) return false;
  resumeBtn.addEventListener('click', () => {
    const resumeSessionArg = documentImpl.body.dataset.sessionUuid;
    const command = 'pi --session ' + resumeSessionArg;
    copyText(command, () => showResumeCopiedNotice(command, state, { documentImpl, setTimeoutImpl, clearTimeoutImpl }), { documentImpl, navigatorImpl });
  });
  return true;
}
