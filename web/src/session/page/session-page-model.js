import { createSessionDataModel, decodeBase64JSON } from '../data/session-data.js';
import { createSessionNavigator } from '../navigation/session-navigation.js';
import { setSessionRuntime } from '../session-runtime-context.js';

export function hydrateSessionModel({
  sessionModel,
  payloadBase64,
  locationSearch = '',
  windowImpl = window,
} = {}) {
  sessionModel.load(createSessionDataModel(
    decodeBase64JSON(payloadBase64, { atobImpl: windowImpl.atob?.bind(windowImpl) }),
    new URLSearchParams(locationSearch),
  ));
  return sessionModel;
}

export function createLiveSessionRuntime({
  sessionModel,
  contentRuntime,
  windowImpl = window,
  documentImpl = document,
} = {}) {
  const navigator = createSessionNavigator({
    documentImpl,
    onNavigate: (leaf, target) => {
      sessionModel.currentLeafId = leaf;
      sessionModel.currentTargetId = target;
    },
  });

  return setSessionRuntime({
    model: sessionModel,
    navigator,
    navigateTo: navigator.navigateTo,
    reconcileEntries: (entries) => sessionModel.reconcile(entries),
    contentRuntime,
  }, { windowImpl });
}
