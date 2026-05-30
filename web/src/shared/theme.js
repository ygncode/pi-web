export function applyTheme(windowImpl, documentImpl, next) {
  next = next || 'dark';
  documentImpl.documentElement.dataset.theme = next;
  try { windowImpl.localStorage.setItem('pi-web-theme', next); } catch (e) {}
  try { documentImpl.cookie = 'pi-web-theme=' + next + ';path=/;SameSite=Lax;max-age=31536000'; } catch (e) {}
  const meta = documentImpl.querySelector('meta[name="theme-color"]');
  if (meta) {
    let color = '#111116';
    if (next === 'light') color = '#f6f5f2';
    else if (next === 'nord') color = '#2e3440';
    else if (next === 'dracula') color = '#282a36';
    meta.content = color;
  }
}

export function toggleTheme(windowImpl, documentImpl) {
  const themes = ['dark', 'light', 'nord', 'dracula', 'custom'];
  const current = documentImpl.documentElement.dataset.theme || 'dark';
  let idx = themes.indexOf(current);
  if (idx === -1) idx = 0;
  const next = themes[(idx + 1) % themes.length];
  applyTheme(windowImpl, documentImpl, next);
}

export function syncThemeIcons(documentImpl) {
  const current = documentImpl.documentElement.dataset.theme || 'dark';
  let icon = '◐';
  if (current === 'light') icon = '☀';
  else if (current === 'nord') icon = '❄';
  else if (current === 'dracula') icon = '🧛';
  else if (current === 'custom') icon = '⚙';

  documentImpl.querySelectorAll('[data-command-theme-icon]').forEach((el) => {
    el.textContent = icon;
  });
  documentImpl.querySelectorAll('[data-theme-icon]').forEach((el) => {
    el.textContent = icon;
  });
}
