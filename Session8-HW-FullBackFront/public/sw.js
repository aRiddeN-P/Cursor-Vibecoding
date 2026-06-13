/**
 * sw.js — Dakhlyar Service Worker (Phase 3-F)
 *
 * Served from the ROOT path (/sw.js). Do NOT move under /js/ — the SW scope
 * defaults to the directory it's served from, and we want it to be /.
 *
 * Responsibilities:
 *   1. `push`                  → render a notification
 *   2. `notificationclick`     → focus an open tab or open a new one
 *   3. `pushsubscriptionchange`→ resubscribe and sync with backend
 */
'use strict';

const DEFAULT_TITLE = 'دخلیار';
const DEFAULT_URL   = '/dashboard.html';
const ICON_URL      = '/icons/icon-192.png';
const BADGE_URL     = '/icons/badge-72.png';

self.addEventListener('install', (event) => {
  // Activate on the next loaded page without forcing a reload.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  if (!event || !event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (_) {
    try { data = { title: DEFAULT_TITLE, body: event.data.text() }; }
    catch (_e) { data = {}; }
  }

  const title = data.title || DEFAULT_TITLE;
  const options = {
    body: data.body || '',
    icon: ICON_URL,
    badge: BADGE_URL,
    dir: 'rtl',
    lang: 'fa',
    tag: data.tag || ('dakhlyar-' + Date.now()),
    renotify: data.renotify === true,
    requireInteraction: data.requireInteraction === true,
    data: {
      url: data.url || DEFAULT_URL,
      message_id: data.message_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || DEFAULT_URL;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        // Try to focus an existing tab that already shows the target path.
        for (const client of clientList) {
          try {
            if (client.url && client.url.indexOf(targetUrl) !== -1 && 'focus' in client) {
              return client.focus();
            }
          } catch (_) { /* ignore */ }
        }
        // Otherwise, open a brand-new window/tab on the target URL.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('pushsubscriptionchange', function (event) {
  // Browser rotated the keys for our subscription. Try to re-subscribe and
  // resync with the backend.
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('/api/push/vapid-public-key');
        if (!res.ok) return;
        const { publicKey } = await res.json();
        if (!publicKey) return;

        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            endpoint: newSub.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(newSub.getKey('p256dh')),
              auth:   arrayBufferToBase64(newSub.getKey('auth')),
            },
          }),
        });
      } catch (err) {
        // We can't show UI here; just swallow.
      }
    })()
  );
});

// ── helpers (also defined in push-init.js for the page) ─────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
