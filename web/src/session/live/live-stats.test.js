import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { computeLiveStats, formatTokens, updateStatsDom } from './live-stats.js';

describe('live stats', () => {
  it('formats tokens', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1500)).toBe('1.5k');
    expect(formatTokens(15000)).toBe('15k');
  });

  it('computes and updates header stats', () => {
    const entries = [
      { type: 'message', message: { role: 'user' } },
      { type: 'message', message: { role: 'assistant', provider: 'p', model: 'm', usage: { input: 1000, output: 2000, cost: { input: 0.001, output: 0.002 } }, content: [{ type: 'toolCall' }] } }
    ];
    const stats = computeLiveStats(entries);
    expect(stats.user).toBe(1);
    expect(stats.assistant).toBe(1);
    expect(stats.toolCalls).toBe(1);

    const dom = new JSDOM(`<div class="header-info">
      <div class="info-item"><span class="info-label">Messages:</span><span class="info-value"></span></div>
      <div class="info-item"><span class="info-label">Tool Calls:</span><span class="info-value"></span></div>
      <div class="info-item"><span class="info-label">Models:</span><span class="info-value"></span></div>
      <div class="info-item"><span class="info-label">Tokens:</span><span class="info-value"></span></div>
      <div class="info-item"><span class="info-label">Cost:</span><span class="info-value"></span></div>
    </div>`);
    expect(updateStatsDom(entries, { documentImpl: dom.window.document })).toBe(true);
    expect(dom.window.document.querySelectorAll('.info-value')[0].textContent).toBe('1 user, 1 assistant');
    expect(dom.window.document.querySelectorAll('.info-value')[1].textContent).toBe('1');
    expect(dom.window.document.querySelectorAll('.info-value')[2].textContent).toBe('p/m');
    expect(dom.window.document.querySelectorAll('.info-value')[3].textContent).toBe('↑1.0k ↓2.0k');
    expect(dom.window.document.querySelectorAll('.info-value')[4].textContent).toBe('$0.003');
  });
});
