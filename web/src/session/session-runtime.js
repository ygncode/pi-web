// Imperative-handle registry for the live session viewer. Replaces the
// window.__pi* bridges by which child components published their imperative
// control surfaces for other components and plain-JS runtime modules to call.
// Each component assigns its slot on mount and clears it (null) on destroy;
// consumers read `sessionRuntime.<slot>?.method()`. Reads are all imperative
// (event handlers / onMount), so a plain object is enough — no reactivity needed.
//
// There is one session viewer at a time, so a module singleton suffices;
// resetSessionRuntime() clears it when <SessionPage> unmounts so SPA re-entry
// never sees a stale handle. Kept dependency-free so it stays safe to pull into
// the server-less export bundle (via session-ui-runner).
export const sessionRuntime = {
  annotations: null, // { init, setAnnotations, reapply, refresh }
  artifacts: null, // { setArtifacts, selectArtifact, getArtifact, getCount, ... }
  rightSidebar: null, // { toggle, open, collapse, activateTab }
  layout: null, // { isMobileLayout, closeSidebar }
  toggleState: null, // toggle controller { applyToNode, toggleThinking, ... }
};

export function resetSessionRuntime() {
  sessionRuntime.annotations = null;
  sessionRuntime.artifacts = null;
  sessionRuntime.rightSidebar = null;
  sessionRuntime.layout = null;
  sessionRuntime.toggleState = null;
}
