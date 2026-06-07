<script>
  // Live reload (SSE) — drives the streaming chat preview, follow/scroll, stats,
  // and reconciles the shared reactive model when the session JSONL changes. The
  // Svelte <SessionContent> owns #messages and re-renders from the model, so this
  // runs in reactiveContent mode (no DOM patching). Live-only: never imported by
  // the static export bundle.
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { runLiveReload } from '../../session/live/live-reload-runner.js';
  import * as liveEntries from '../../session/live/live-entries.js';
  import * as liveRenderer from '../../session/live/live-renderer.js';
  import * as liveScroll from '../../session/live/live-scroll.js';
  import * as liveStats from '../../session/live/live-stats.js';
  import * as liveEvents from '../../session/live/live-events.js';
  import * as chatPreview from '../../session/live/chat-preview.js';

  onMount(() => {
    const target = window;
    const model = target.__piSessionDataModel;
    globalThis.__PI_TEST_LIVE_RELOAD_HOOK__?.();
    runLiveReload({
      documentImpl: document,
      windowImpl: target,
      locationImpl: target.location,
      navigatorImpl: target.navigator,
      markedImpl: marked,
      fetchImpl: target.fetch.bind(target),
      EventSourceImpl: target.EventSource,
      requestAnimationFrameImpl: target.requestAnimationFrame.bind(target),
      setTimeoutImpl: target.setTimeout.bind(target),
      clearTimeoutImpl: target.clearTimeout.bind(target),
      liveEntries,
      liveRenderer,
      liveScroll,
      liveStats,
      liveEvents,
      chatPreview,
      cwd: model?.header?.cwd || '',
      reactiveContent: true,
      getInitialEntryIds: () => (target.__piSessionDataModel?.entries || []).map((e) => e.id).filter(Boolean),
      // session.js owns model reconciliation (also used by load-earlier) and
      // exposes it here; the annotation layer bridge handles annotation snapshots.
      // Both are read lazily: they're ready before the first SSE event fires.
      onSessionDataReload: (data) => target.__piReconcileEntries?.(data.entries),
      onAnnotations: (list) => target.__piAnnotationLayer?.setAnnotations(list),
    });
  });
</script>
