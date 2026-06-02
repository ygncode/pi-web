// Skill listing for the chat composer. Typing exactly "/skill" in the message
// box lists the skills loaded by the session's pi worker. Skills are exposed by
// pi's get_commands RPC as commands named "skill:<name>" with source "skill".

const SKILL_TRIGGER = '/skill';

export function isSkillTrigger(value) {
  return typeof value === 'string' && value.trim() === SKILL_TRIGGER;
}

// extractSkills filters a get_commands list down to skills and strips the
// "skill:" prefix pi uses on their command names for display.
export function extractSkills(commands) {
  if (!Array.isArray(commands)) return [];
  return commands
    .filter((c) => c && c.source === 'skill')
    .map((c) => {
      const name = String(c.name || '');
      return {
        name,
        displayName: name.startsWith('skill:') ? name.slice('skill:'.length) : name,
        description: String(c.description || ''),
      };
    });
}

export const SKILL_LOAD_BUTTON_ID = 'pi-chat-skill-load';

export function renderSkillList(skills, { workerReady = true, escapeHtml = String } = {}) {
  if (!workerReady) {
    return (
      '<div class="pi-chat-skill-empty">No skills loaded yet</div>' +
      `<button type="button" id="${SKILL_LOAD_BUTTON_ID}" class="pi-chat-skill-load">Load skills</button>`
    );
  }
  if (!skills || skills.length === 0) {
    return '<div class="pi-chat-skill-empty">No skills loaded</div>';
  }
  return skills
    .map((s) => {
      const desc = s.description
        ? `<span class="pi-chat-skill-desc">${escapeHtml(s.description)}</span>`
        : '';
      return `<div class="pi-chat-skill-item" data-skill="${escapeHtml(s.name || '')}"><span class="pi-chat-skill-name">${escapeHtml(s.displayName)}</span>${desc}</div>`;
    })
    .join('');
}

export function setupSkillList({
  documentImpl = document,
  sessionId,
  chatApi,
  escapeHtml = String,
} = {}) {
  const popup = documentImpl.getElementById('pi-chat-skill-popup');
  const list = documentImpl.getElementById('pi-chat-skill-list');

  function close() {
    if (popup) popup.style.display = 'none';
  }

  function show(html) {
    if (!popup || !list) return;
    list.innerHTML = html;
    popup.style.display = 'block';
  }

  // fetchAndRender queries the commands endpoint and renders the result.
  // When load is true the server spawns the worker first (used by the explicit
  // "Load skills" button); otherwise it only peeks at an existing worker.
  async function fetchAndRender(load) {
    if (!chatApi || typeof chatApi.getCommands !== 'function') return;
    // Injecting the popup's DOM while the textarea is focused makes iOS Safari
    // blur it (dismissing the keyboard and shifting focus). Re-assert focus
    // after each render — preventScroll stops iOS's jumpy scroll-into-view.
    const textarea = documentImpl.getElementById('pi-chat-message');
    const keepFocus = () => {
      if (textarea && documentImpl.activeElement !== textarea && typeof textarea.focus === 'function') {
        textarea.focus({ preventScroll: true });
      }
    };
    show('<div class="pi-chat-skill-empty">Loading…</div>');
    keepFocus();
    try {
      const res = await chatApi.getCommands(sessionId, { load });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed to load skills');
      const skills = extractSkills(data.commands);
      show(renderSkillList(skills, { workerReady: data.workerReady, escapeHtml }));
    } catch (_) {
      show('<div class="pi-chat-skill-empty">Failed to load skills</div>');
    }
    keepFocus();
  }

  // maybeShow opens the skill list when the composer value is exactly "/skill",
  // otherwise hides it. Returns a promise so callers/tests can await the fetch.
  function maybeShow(value) {
    if (!isSkillTrigger(value)) {
      close();
      return Promise.resolve();
    }
    return fetchAndRender(false);
  }

  // load spawns the worker on demand and lists its skills. Bound to the
  // "Load skills" button shown when no worker is running yet.
  function load() {
    return fetchAndRender(true);
  }

  // insertSkill writes the skill's slash invocation into the composer so the
  // user only has to press send. The skill name is already prefixed "skill:",
  // so the invocation is "/skill:<name>".
  function insertSkill(name) {
    if (!name) return;
    const textarea = documentImpl.getElementById('pi-chat-message');
    if (!textarea) return;
    textarea.value = `/${name} `;
    if (typeof textarea.focus === 'function') textarea.focus();
    if (typeof textarea.dispatchEvent === 'function') {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    close();
  }

  documentImpl.addEventListener('click', (e) => {
    const target = e && e.target;
    if (target && target.id === SKILL_LOAD_BUTTON_ID) {
      load();
      return;
    }
    const item = target && typeof target.closest === 'function'
      ? target.closest('.pi-chat-skill-item')
      : null;
    if (item && typeof item.getAttribute === 'function') {
      insertSkill(item.getAttribute('data-skill'));
      return;
    }
    if (popup && popup.style.display !== 'none') {
      const textarea = documentImpl.getElementById('pi-chat-message');
      if (!popup.contains(target) && target !== textarea) close();
    }
  });

  return { maybeShow, load, insertSkill, close };
}
