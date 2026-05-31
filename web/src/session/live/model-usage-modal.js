/**
 * Model Usage Modal — displays token, cost, and per-model breakdowns
 * inside a reusable fullscreen sheet.
 */

import { showSheet } from './full-screen-sheet.js';

function formatCost(n) {
  const value = Number.isFinite(n) ? n : 0;
  return '$' + value.toFixed(3);
}

function computeModelBreakdown(entryList = []) {
  const modelTokens = {};

  for (const entry of entryList) {
    if (entry?.type !== 'message') continue;
    const msg = entry.message;
    if (!msg || msg.role !== 'assistant' || !msg.model) continue;

    const key = msg.provider ? `${msg.provider}/${msg.model}` : msg.model;
    if (!modelTokens[key]) modelTokens[key] = 0;

    if (msg.usage) {
      const total = (msg.usage.input || 0) + (msg.usage.output || 0)
        + (msg.usage.cacheRead || 0) + (msg.usage.cacheWrite || 0);
      modelTokens[key] += total;
    }
  }

  const totalAll = Object.values(modelTokens).reduce((a, b) => a + b, 0);
  return Object.entries(modelTokens)
    .map(([name, tokens]) => ({
      name,
      tokens,
      percent: totalAll > 0 ? (tokens / totalAll) * 100 : 0,
    }))
    .filter(m => m.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);
}

function shortenModelName(name) {
  const parts = name.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : name;
}

function prettifyModelName(name) {
  const short = shortenModelName(name);
  return short
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+\d{4}\d{2}\d{2}$/, ''); // strip date suffix
}

// Color palette for model dots (reused per index)
const MODEL_DOT_COLORS = [
  '#8abeb7', '#cc6666', '#81a2be', '#b5bd68', '#de935f',
  '#a3685a', '#f0c674', '#b294bb', '#5f819d', '#9a7b6b',
];

/**
 * @typedef ModelUsageStats
 * @property {{ input: number, output: number, cacheRead: number, cacheWrite: number }} tokens
 * @property {{ input: number, output: number, cacheRead: number, cacheWrite: number }} cost
 * @property {number} toolCalls
 * @property {string[]} models
 * @property {Array<{ type: string, message?: object }>} _entries
 */

/**
 * Returns the HTML body for the model usage panel.
 * @param {{ stats: ModelUsageStats, escapeHtml: (s: string) => string, formatTokens: (n: number) => string }} opts
 */
export function renderModelUsageBody({ stats, escapeHtml, formatTokens }) {
  const tokens = stats.tokens ?? {};
  const cost = stats.cost ?? {};
  const totalCost = (cost.input || 0) + (cost.output || 0) + (cost.cacheRead || 0) + (cost.cacheWrite || 0);
  const modelBreakdown = computeModelBreakdown(stats._entries || []);

  const totalTokens = (tokens.input || 0) + (tokens.output || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0);

  const tokenRows = [
    { label: 'Input', value: tokens.input || 0 },
    { label: 'Output', value: tokens.output || 0 },
    { label: 'Cache read', value: tokens.cacheRead || 0 },
    { label: 'Cache write', value: tokens.cacheWrite || 0 },
  ].filter(r => r.value > 0);

  return `
    <div class="mu-section">
      <div class="mu-label">Total cost</div>
      <div class="mu-cost">${formatCost(totalCost)}</div>
    </div>

    ${tokenRows.length > 0 ? `
    <div class="mu-card">
      <div class="mu-card-title">Tokens</div>
      ${tokenRows.map(r => `
        <div class="mu-token-row">
          <span class="mu-token-name">${escapeHtml(r.label)}</span>
          <div class="mu-token-bar-wrap">
            <div class="mu-token-bar" style="width: ${Math.max(3, (r.value / (totalTokens || 1)) * 100)}%;"></div>
          </div>
          <span class="mu-token-value">${formatTokens(r.value)}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${modelBreakdown.length > 0 ? `
    <div class="mu-card">
      <div class="mu-card-title">Models</div>
      ${modelBreakdown.map((m, i) => `
        <div class="mu-model-block">
          <div class="mu-model-header">
            <span class="mu-model-dot" style="background:${MODEL_DOT_COLORS[i % MODEL_DOT_COLORS.length]}"></span>
            <span class="mu-model-name" title="${escapeHtml(m.name)}">${escapeHtml(prettifyModelName(m.name))}</span>
            <span class="mu-model-pct">${Math.round(m.percent)}%</span>
          </div>
          <div class="mu-model-bar-wrap">
            <div class="mu-model-bar" style="width:${Math.max(2, m.percent)}%; background:${MODEL_DOT_COLORS[i % MODEL_DOT_COLORS.length]}"></div>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="mu-card">
      <div class="mu-stat-row">
        <span class="mu-stat-label">Tool calls</span>
        <span class="mu-stat-value">${stats.toolCalls || 0}</span>
      </div>
      <div class="mu-stat-row">
        <span class="mu-stat-label">Models</span>
        <span class="mu-stat-value">${(stats.models || []).length}</span>
      </div>
      <div class="mu-stat-row">
        <span class="mu-stat-label">Messages</span>
        <span class="mu-stat-value">${(stats._entries || []).filter(e => e.type === 'message').length}</span>
      </div>
    </div>
  `;
}

function computeStatsFromEntries(entries) {
  let toolCalls = 0;
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const models = new Set();

  for (const entry of entries) {
    if (entry?.type !== 'message') continue;
    const msg = entry.message;
    if (!msg || msg.role !== 'assistant') continue;
    if (msg.model) models.add(msg.provider ? `${msg.provider}/${msg.model}` : msg.model);
    if (msg.usage) {
      tokens.input += msg.usage.input || 0;
      tokens.output += msg.usage.output || 0;
      tokens.cacheRead += msg.usage.cacheRead || 0;
      tokens.cacheWrite += msg.usage.cacheWrite || 0;
      if (msg.usage.cost) {
        cost.input += msg.usage.cost.input || 0;
        cost.output += msg.usage.cost.output || 0;
        cost.cacheRead += msg.usage.cost.cacheRead || 0;
        cost.cacheWrite += msg.usage.cost.cacheWrite || 0;
      }
    }
    if (Array.isArray(msg.content)) {
      toolCalls += msg.content.filter(c => c.type === 'toolCall').length;
    }
  }

  return { tokens, cost, toolCalls, models: Array.from(models), _entries: entries };
}

export function showModelUsageModal({ entries = [], escapeHtml, formatTokens, documentImpl = document, windowImpl = window, requestAnimationFrameImpl } = {}) {
  const stats = computeStatsFromEntries(entries);

  return showSheet({
    title: 'Usage',
    renderBody: ({ bodyEl }) => {
      bodyEl.classList?.add('mu-sheet-body');
      const panel = bodyEl.closest?.('.pi-sheet-panel');
      panel?.classList?.add('mu-sheet-panel');
      panel?.closest?.('.pi-sheet-backdrop')?.classList?.add('mu-sheet-backdrop');

      return renderModelUsageBody({ stats, escapeHtml, formatTokens });
    },
    documentImpl,
    windowImpl,
    requestAnimationFrameImpl,
  });
}
