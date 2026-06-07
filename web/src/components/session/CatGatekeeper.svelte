<script>
  // Cat Gatekeeper overlay (view) + controller wiring. The timer/phase logic
  // lives in cat-gatekeeper.js (DI-testable, no DOM); this component renders the
  // enforced break / bedtime overlay reactively and blocks input while it shows.
  // Live-only. The overlay relocates to <body> so its fixed, full-screen, very
  // high z-index layer is viewport-relative regardless of ancestor transforms.
  import { onMount } from 'svelte';
  import { setupCatGatekeeper } from '../../session/cat-gatekeeper/cat-gatekeeper.js';

  let overlayEl = $state();
  let videoEl = $state();

  let visible = $state(false);
  let everShown = $state(false);
  let variant = $state('break'); // break | sleep | locked
  let timerText = $state('');
  let showTimer = $state(false);
  let messageText = $state('');
  let showMessage = $state(false);
  let showSnooze = $state(false);

  // Assigned in onMount; the snooze button (rendered before mount) reads it here.
  let controller = null;

  function onSnooze(e) {
    e.preventDefault();
    e.stopPropagation();
    controller?.snooze?.();
  }

  onMount(() => {
    const doc = document;
    const win = window;
    if (overlayEl) doc.body.appendChild(overlayEl);

    let inputBlockers = null;
    function blockInput() {
      if (inputBlockers) return;
      const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
      const swallowWheel = (e) => { e.preventDefault(); };
      doc.addEventListener('keydown', swallow, true);
      doc.addEventListener('wheel', swallowWheel, { capture: true, passive: false });
      doc.addEventListener('touchmove', swallowWheel, { capture: true, passive: false });
      inputBlockers = { swallow, swallowWheel };
      try { doc.activeElement?.blur?.(); } catch { /* ignore */ }
    }
    function unblockInput() {
      if (!inputBlockers) return;
      doc.removeEventListener('keydown', inputBlockers.swallow, true);
      doc.removeEventListener('wheel', inputBlockers.swallowWheel, { capture: true });
      doc.removeEventListener('touchmove', inputBlockers.swallowWheel, { capture: true });
      inputBlockers = null;
    }

    function playVideo() {
      if (!videoEl) return;
      try {
        videoEl.currentTime = 0;
        videoEl.playbackRate = 0.6; // calmer, slower cat
        const p = videoEl.play();
        if (p && p.catch) p.catch(() => {});
      } catch { /* ignore */ }
    }

    const view = {
      showBreak(text) {
        variant = 'break';
        everShown = true;
        showTimer = true;
        timerText = text;
        showMessage = false;
        showSnooze = false;
        visible = true;
        blockInput();
        win.requestAnimationFrame?.(playVideo);
      },
      setBreakTimer(text) { timerText = text; },
      showSleep({ locked, showSnooze: snooze, message }) {
        variant = locked ? 'locked' : 'sleep';
        everShown = true;
        showTimer = false;
        showMessage = true;
        messageText = message;
        showSnooze = !!snooze;
        visible = true;
        blockInput();
        win.requestAnimationFrame?.(playVideo);
      },
      hide() {
        visible = false;
        unblockInput();
      },
    };

    const isActive = () => {
      const hidden = doc.hidden === true || doc.visibilityState === 'hidden';
      let focused = true;
      try { if (typeof doc.hasFocus === 'function') focused = doc.hasFocus(); } catch { /* assume focused */ }
      return !hidden && focused;
    };

    controller = setupCatGatekeeper({ windowImpl: win, storage: win.localStorage, isActive, view });
    controller.start();

    // Test seam: the enforced break only fires after the (25-min) focus timer,
    // so the e2e suite forces it via skipToBreak(). The controller has no in-app
    // consumers, so this stays a plain window hook rather than a sessionRuntime
    // registry slot. Cleared on destroy so SPA re-entry never sees a stale one.
    win.__piCatGatekeeper = controller;

    return () => {
      controller.destroy();
      unblockInput();
      overlayEl?.remove();
      if (win.__piCatGatekeeper === controller) win.__piCatGatekeeper = null;
      controller = null;
    };
  });
</script>

<div
  id="cat-gatekeeper-overlay"
  class="cat-overlay"
  class:cat-overlay--break={variant === 'break'}
  class:cat-overlay--sleep={variant === 'sleep' || variant === 'locked'}
  class:cat-overlay--locked={variant === 'locked'}
  class:visible
  class:cat-overlay-hidden={everShown && !visible}
  aria-hidden={!visible}
  bind:this={overlayEl}
>
  <div class="cat-overlay-inner">
    <div class="cat-art" data-cat-art>
      {#if everShown}<video class="cat-video" bind:this={videoEl} src="/cat.webm" autoplay loop muted playsinline aria-label="cat"></video>{/if}
    </div>
    <div class="cat-timer" data-cat-timer style:display={showTimer ? '' : 'none'}>{timerText}</div>
    <div class="cat-message" data-cat-message style:display={showMessage ? '' : 'none'}>{messageText}</div>
    <button type="button" class="cat-snooze" data-cat-snooze style:display={showSnooze ? '' : 'none'} onclick={onSnooze}>Snooze 5 min</button>
  </div>
</div>
