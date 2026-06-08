import { createAnnotationApi } from '../annotations/annotation-api.js';
import { sessionRuntime } from '../session-runtime.js';

export function setupSessionAnnotations({
  sessionId,
  ui,
  windowImpl = window,
  documentImpl = document,
} = {}) {
  const annotationLayer = sessionRuntime.annotations || null;
  const messagesEl = documentImpl.getElementById('messages');
  if (!annotationLayer || !messagesEl || !sessionId) return () => {};

  const annotationArtifactHost = documentImpl.getElementById('artifact-panel-host');
  annotationLayer.init({
    api: createAnnotationApi({ sessionId, fetchImpl: windowImpl.fetch.bind(windowImpl) }),
    scopes: [messagesEl, annotationArtifactHost].filter(Boolean),
    composerEl: documentImpl.getElementById('pi-chat-message'),
    countEl: documentImpl.getElementById('annotation-tab-count'),
    onSelectArtifact: (artifactId) => {
      ui.activateRightTab('artifacts');
      sessionRuntime.artifacts?.selectArtifact(artifactId);
    },
    onCreate: () => {
      ui.openRightSidebar();
      ui.activateRightTab('notes');
    },
    onSend: () => {
      if (ui.isMobileLayout()) ui.collapseRightSidebar();
    },
    onAddToChat: (attachment) => {
      windowImpl.dispatchEvent(new windowImpl.CustomEvent('pi-chat-attach-text', { detail: attachment }));
      if (ui.isMobileLayout()) ui.collapseRightSidebar();
    },
    resolveArtifact: (artifactId) => sessionRuntime.artifacts?.getArtifact(artifactId) || null,
  });

  const onAnnotationReload = () => annotationLayer.reapply();
  windowImpl.addEventListener('pi-session-reload', onAnnotationReload);
  return () => windowImpl.removeEventListener('pi-session-reload', onAnnotationReload);
}
