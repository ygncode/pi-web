import { describe, expect, it, vi } from 'vitest';
import { cancelChat, chatUrl, getCommands, getWorkerStatus, listModels, sendChat, setModel, setThinkingLevel } from './chat-api.js';

describe('chat api helpers', () => {
  it('builds encoded session URLs', () => {
    expect(chatUrl('/api/chat', 'session 1.jsonl')).toBe('/api/chat?id=session%201.jsonl');
  });

  it('wraps chat endpoints', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}')));
    const body = new FormData();

    await sendChat('s.jsonl', body, { fetchImpl });
    await cancelChat('s.jsonl', { fetchImpl });
    await getWorkerStatus('s.jsonl', { fetchImpl });
    await listModels({ fetchImpl });
    await setModel('s.jsonl', { provider: 'p', modelId: 'm' }, { fetchImpl });
    await setThinkingLevel('s.jsonl', 'medium', { fetchImpl });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/api/chat?id=s.jsonl', { method: 'POST', body });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/api/chat/cancel?id=s.jsonl', { method: 'POST' });
    expect(fetchImpl).toHaveBeenNthCalledWith(3, '/api/worker-status?id=s.jsonl');
    expect(fetchImpl).toHaveBeenNthCalledWith(4, '/api/models');
    expect(fetchImpl).toHaveBeenNthCalledWith(5, '/api/set-model?id=s.jsonl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'p', modelId: 'm' })
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(6, '/api/set-thinking-level?id=s.jsonl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'medium' })
    });
  });

  it('builds command URLs with and without load', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}')));
    await getCommands('s.jsonl', {}, { fetchImpl });
    await getCommands('s.jsonl', { load: true }, { fetchImpl });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/api/commands?id=s.jsonl');
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/api/commands?id=s.jsonl&load=1');
  });
});
