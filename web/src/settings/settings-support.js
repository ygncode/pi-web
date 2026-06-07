import { configureSettingsSync, hydrateSettings, writeSetting } from '../shared/settings-store.js';
import { t } from '../shared/i18n.js';

export async function loadSettings({ windowImpl = window } = {}) {
  const fetchImpl = windowImpl.fetch ? windowImpl.fetch.bind(windowImpl) : undefined;
  configureSettingsSync({ fetchImpl });
  const storage = windowImpl.localStorage;
  return (await hydrateSettings({ fetchImpl, storage })) || {};
}

export function valueFor(settings, key, fallback = '', { storage = localStorage } = {}) {
  if (settings && key in settings) return settings[key];
  try {
    const stored = storage?.getItem(key);
    if (stored != null) return stored;
  } catch {}
  return fallback;
}

export function boolFor(settings, key, fallback = false, opts = {}) {
  return String(valueFor(settings, key, fallback ? 'true' : 'false', opts)) === 'true';
}

export function persistSetting(key, value, { storage = localStorage } = {}) {
  writeSetting(key, value, { storage });
}

export function setupBackLink(documentImpl, windowImpl) {
  const link = documentImpl.querySelector('[data-settings-back]');
  if (!link) return;
  let fromApp = false;
  try {
    const ref = documentImpl.referrer;
    fromApp = !!ref
      && new URL(ref).origin === windowImpl.location.origin
      && new URL(ref).pathname !== '/settings';
  } catch {
    fromApp = false;
  }
  if (!fromApp) return;
  const label = link.querySelector('[data-settings-back-label]');
  if (label) label.textContent = t('common.back');
  link.addEventListener('click', (e) => {
    e.preventDefault();
    if (windowImpl.history && windowImpl.history.length > 1) windowImpl.history.back();
    else windowImpl.location.href = '/';
  });
}

export async function fetchModelGroups({ fetchImpl = fetch } = {}) {
  let models;
  try {
    const resp = await fetchImpl('/api/models', { headers: { Accept: 'application/json' } });
    if (!resp.ok) return [];
    const data = await resp.json();
    models = Array.isArray(data?.models) ? data.models : null;
  } catch {
    return [];
  }
  if (!models?.length) return [];
  const byProvider = new Map();
  for (const m of models) {
    const id = m.id || m.modelId || '';
    const provider = m.provider || '';
    if (!id || !provider) continue;
    if (!byProvider.has(provider)) byProvider.set(provider, []);
    byProvider.get(provider).push({ id, name: m.name || id, value: `${provider}/${id}` });
  }
  return Array.from(byProvider.keys()).sort((a, b) => a.localeCompare(b)).map((provider) => ({
    provider,
    models: byProvider.get(provider),
  }));
}
