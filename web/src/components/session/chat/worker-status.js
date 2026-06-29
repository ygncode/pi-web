export function setupWorkerStatusPolling({
  windowImpl = window,
  chatApi,
  sessionId = '',
  setStatus = () => {},
  setModelLabel = () => {},
  setThinkingLabel = () => {},
  updateContextUsage = () => {},
  getKnownModelLabel = () => '',
  setKnownModelLabel = () => {},
  getKnownThinkingLevel = () => '',
  setKnownThinkingLevel = () => {},
  getWorkerModelUpdate = () => null,
  getCompact = () => null,
  setIntervalImpl = windowImpl.setInterval?.bind(windowImpl),
  CustomEventImpl = windowImpl.CustomEvent,
  intervalMs = 1500,
} = {}) {
  let inflight = false;
  let pending = false;
  let lastWorkerState = null;

  async function refresh() {
    if (inflight) {
      // Queue exactly one follow-up so an in-flight response cannot swallow a
      // newer state change, such as the assistant finishing while we poll stale
      // "running" state.
      pending = true;
      return;
    }
    inflight = true;
    try {
      const response = await chatApi?.getWorkerStatus?.(sessionId);
      if (!response?.ok) return;
      const data = await response.json();
      const apiModelLabel = data.model
        ? data.model + (data.modelProvider ? ' @ ' + data.modelProvider : '')
        : '';
      if (apiModelLabel) setKnownModelLabel(apiModelLabel);
      if (data.thinkingLevel) setKnownThinkingLevel(data.thinkingLevel);
      const compact = getCompact?.();
      // While compacting, pin the label to "compacting" (running cls so Cancel
      // stays available) regardless of the polled state.
      if (data.state === 'running')
        setStatus(compact?.isCompacting() ? 'compacting' : 'running', 'running');
      if (data.state === 'idle')
        setStatus(
          compact?.isCompacting() ? 'compacting' : 'idle',
          compact?.isCompacting() ? 'running' : '',
        );
      if (data.state === 'error') {
        compact?.setCompacting(false);
        setStatus(data.error || 'worker error', 'error');
      }
      if (lastWorkerState === 'running' && data.state === 'idle') {
        // Compaction (or any run) finished — clear the compacting banner/label.
        compact?.setCompacting(false);
        try {
          windowImpl.dispatchEvent(new CustomEventImpl('pi-worker-done'));
        } catch {
          // Some tests/environments may not support constructing events.
        }
      }
      if (data.state) lastWorkerState = data.state;
      compact?.setWorkerRunning(lastWorkerState === 'running');
      setModelLabel(getKnownModelLabel());
      setThinkingLabel(getKnownThinkingLevel());
      updateContextUsage();
      const onWorkerModelUpdate = getWorkerModelUpdate?.();
      if (data.modelProvider && data.model && onWorkerModelUpdate) {
        onWorkerModelUpdate(data.modelProvider, data.model);
      }
    } catch {
      setStatus('status unavailable', 'error');
    } finally {
      inflight = false;
      if (pending) {
        pending = false;
        void refresh();
      }
    }
  }

  if (setIntervalImpl) setIntervalImpl(refresh, intervalMs);
  void refresh();
  updateContextUsage();

  const onSessionReload = () => {
    // Compaction completes by writing the session + broadcasting reload; clear
    // the compacting banner/label before the status poll resolves real state.
    getCompact?.()?.setCompacting(false);
    void refresh();
    updateContextUsage();
  };
  windowImpl.addEventListener?.('pi-session-reload', onSessionReload);

  return {
    refresh,
    dispose: () => {
      windowImpl.removeEventListener?.('pi-session-reload', onSessionReload);
    },
  };
}
