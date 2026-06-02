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

export function renderSkillList(skills, { workerReady = true, escapeHtml = String } = {}) {
  if (!workerReady) {
    return '<div class="pi-chat-skill-empty">Send a message first to load skills</div>';
  }
  if (!skills || skills.length === 0) {
    return '<div class="pi-chat-skill-empty">No skills loaded</div>';
  }
  return skills
    .map((s) => {
      const desc = s.description
        ? `<span class="pi-chat-skill-desc">${escapeHtml(s.description)}</span>`
        : '';
      return `<div class="pi-chat-skill-item"><span class="pi-chat-skill-name">${escapeHtml(s.displayName)}</span>${desc}</div>`;
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

  // maybeShow opens the skill list when the composer value is exactly "/skill",
  // otherwise hides it. Returns a promise so callers/tests can await the fetch.
  async function maybeShow(value) {
    if (!isSkillTrigger(value)) {
      close();
      return;
    }
    if (!chatApi || typeof chatApi.getCommands !== 'function') return;
    show('<div class="pi-chat-skill-empty">Loading…</div>');
    try {
      const res = await chatApi.getCommands(sessionId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed to load skills');
      const skills = extractSkills(data.commands);
      show(renderSkillList(skills, { workerReady: data.workerReady, escapeHtml }));
    } catch (_) {
      show('<div class="pi-chat-skill-empty">Failed to load skills</div>');
    }
  }

  documentImpl.addEventListener('click', (e) => {
    if (popup && popup.style.display !== 'none') {
      const textarea = documentImpl.getElementById('pi-chat-message');
      if (!popup.contains(e.target) && e.target !== textarea) close();
    }
  });

  return { maybeShow, close };
}
