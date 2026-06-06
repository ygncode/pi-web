// Svelte context key + thin helpers for sharing the reactive SessionDataModel
// down the component tree (see docs/dev/svelte-migration-plan.md). The page
// component (live SessionPage / static ExportApp) creates the model once and
// calls setSessionModel; descendant components read it with getSessionModel.
//
// Kept in a plain .js module (not a component) so it can be imported from both
// the live and export graphs without pulling in anything live-only.
import { getContext, setContext } from 'svelte';

const SESSION_MODEL = Symbol('pi:session-model');

export function setSessionModel(model) {
  setContext(SESSION_MODEL, model);
  return model;
}

export function getSessionModel() {
  return getContext(SESSION_MODEL);
}
