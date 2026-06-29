// Compact controller — owns the /compact trigger + "compacting" UI state shared
// by the keydown handler, the context popover, and the worker-status poll.
//
// Compaction is NOT a chat prompt: pi's rpc prompt path only expands
// extension/skill/template commands, so sending "/compact" as a message would
// reach the model as literal text and never compact. This calls the dedicated
// POST /api/compact endpoint (which runs pi's `compact` rpc command). While it
// runs, a banner shows above the composer and the status label is pinned to
// "compacting" (see worker-status.js); it clears once the worker returns idle /
// the session reloads.
export function createCompactController({
  documentImpl = document,
  chatApi,
  sessionId = '',
  setStatus = () => {},
} = {}) {
  let compacting = false;

  const banner = () => documentImpl.getElementById('pi-chat-compacting-banner');
  const button = () => documentImpl.getElementById('pi-chat-compact');

  function setCompacting(on) {
    compacting = on;
    const b = banner();
    if (b) b.hidden = !on;
  }

  async function trigger() {
    const btn = button();
    // Disabled button = worker running (set by worker-status); also dedupe.
    if (compacting || (btn && btn.disabled)) return;
    const popover = documentImpl.getElementById('pi-chat-context-popover');
    if (popover) popover.style.display = 'none';
    setCompacting(true);
    setStatus('compacting', 'running');
    try {
      const response = await chatApi.compact(sessionId);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'compact request failed');
      }
    } catch (error) {
      setCompacting(false);
      setStatus(error.message || String(error), 'error');
    }
  }

  // Reflect worker state on the compact button (disabled while running).
  function setWorkerRunning(running) {
    const btn = button();
    if (btn) btn.disabled = running;
  }

  return {
    isCompacting: () => compacting,
    setCompacting,
    setWorkerRunning,
    trigger,
  };
}
