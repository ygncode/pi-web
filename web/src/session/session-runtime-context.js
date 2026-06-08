// Explicit imperative runtime context for the live session page. This is the
// page-owned counterpart to session-runtime.js (component handle registry):
// SessionPage creates the model/navigator/reconcile hooks once, then live
// components and page helpers read them here instead of reaching through window.
//
// The window aliases installed below are temporary compatibility shims for
// older live glue and tests. New/refactored live code should prefer
// getSessionRuntime().

const emptyRuntime = Object.freeze({});
let currentRuntime = emptyRuntime;

export function setSessionRuntime(runtime = {}, { windowImpl = null, installWindowShims = true } = {}) {
  currentRuntime = {
    ...runtime,
    navigateTo: runtime.navigateTo || runtime.navigator?.navigateTo || null,
  };

  if (installWindowShims && windowImpl) {
    installSessionRuntimeWindowShims(currentRuntime, { windowImpl });
  }

  return currentRuntime;
}

export function getSessionRuntime() {
  return currentRuntime;
}

export function resetSessionRuntimeContext({ windowImpl = null, clearWindowShims = true } = {}) {
  currentRuntime = emptyRuntime;
  if (clearWindowShims && windowImpl) clearSessionRuntimeWindowShims({ windowImpl });
}

export function installSessionRuntimeWindowShims(runtime = currentRuntime, { windowImpl = window } = {}) {
  if (!windowImpl) return;

  // Temporary compatibility shims. Keep these aliases until source search and
  // tests prove every consumer has moved to getSessionRuntime().
  windowImpl.__piSessionDataModel = runtime.model || null;
  windowImpl.navigateTo = runtime.navigateTo || runtime.navigator?.navigateTo || null;
  windowImpl.__piSessionNavigator = runtime.navigator || null;
  windowImpl.__piReconcileEntries = runtime.reconcileEntries || null;
  windowImpl.__piContentRuntime = runtime.contentRuntime || null;
}

export function clearSessionRuntimeWindowShims({ windowImpl = window } = {}) {
  if (!windowImpl) return;
  delete windowImpl.__piSessionDataModel;
  delete windowImpl.navigateTo;
  delete windowImpl.__piSessionNavigator;
  delete windowImpl.__piReconcileEntries;
  delete windowImpl.__piContentRuntime;
}
