// Minimal service worker — present so the page is installable as a PWA.
// We intentionally don't cache: pi-web is a live view of local session files
// (SSE for status, streaming chat). Stale cached HTML/JSON would mislead
// the user.
//
// The fetch listener is a no-op (no respondWith) — Chrome accepts that
// for installability and the browser handles every request natively. An
// earlier version called respondWith(fetch(event.request)) which forwarded
// every request through the SW; that added latency to SSE/EventSource and,
// when the server briefly went down, could surface as "Failed to load
// module script: text/html" errors on lazy-loaded JS chunks.

const VERSION = 'v4-no-fetch-handler';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Web Push: show a system notification when the server reports the
// assistant is done. Payload is JSON: { title, body, sessionId, type }.
// If the app is already open and visible, suppress the system push: the page
// handles the foreground "done" cue itself (including done.mp3). When the
// screen is locked/backgrounded or the app is closed, no visible client exists,
// so the push notification is shown normally.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasForegroundClient = clientsList.some((client) => {
      // WindowClient.visibilityState is the ideal signal. Some browsers expose
      // WindowClient.focused instead/also, so treat either as foreground.
      return client.visibilityState === 'visible' || client.focused === true;
    });
    if (hasForegroundClient) return;

    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch (_) {
      data = { title: 'pi session', body: 'Response ready' };
    }
    const title = data.title || 'pi session';
    const options = {
      body: data.body || 'Response ready',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'pi-session-done',
      renotify: true,
      data: { sessionId: data.sessionId || '' },
      // Phones play their default notification sound when this fires.
      silent: false,
    };
    // Badge the app icon so the user notices even after the banner is gone.
    // Cleared when the app is opened/focused (notificationclick + page
    // visibility handler). No-op where the Badging API is unsupported.
    try {
      if (self.navigator && self.navigator.setAppBadge) {
        await self.navigator.setAppBadge(1);
      }
    } catch (_) {}
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const sessionId = event.notification.data && event.notification.data.sessionId;
  const target = sessionId ? `/session?id=${encodeURIComponent(sessionId)}` : '/';
  event.waitUntil((async () => {
    try {
      if (self.navigator && self.navigator.clearAppBadge) {
        await self.navigator.clearAppBadge();
      }
    } catch (_) {}
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.includes(target) && 'focus' in client) {
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
