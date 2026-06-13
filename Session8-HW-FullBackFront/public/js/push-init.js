/**
 * push-init.js — Phase 3-F
 *
 * Loaded on dashboard.html / profile.html / messages.html. Bootstraps the
 * service worker, requests permission via a custom in-app banner (never the
 * browser-native dialog as the first thing the user sees), and registers the
 * push subscription with the backend.
 *
 * Everything is wrapped in try/catch — push is a nice-to-have, never blocks
 * the user from using the app.
 */
(function () {
  'use strict';

  // Expose helpers globally so the banner buttons (inline onclick) can call them.
  window.requestPushPermission = requestPushPermission;
  window.dismissPushBanner = dismissPushBanner;

  async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      let pub = null;
      try {
        const res = await fetch('/api/push/vapid-public-key', { credentials: 'include' });
        if (res.ok) {
          const body = await res.json();
          pub = body.publicKey || null;
        }
      } catch (_) { /* offline / 503 — bail silently */ }

      if (!pub) return; // VAPID not configured server-side; nothing to do.

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        // Keep server in sync (covers fresh login on the same browser).
        await syncSubscription(existing);
        return;
      }

      const permission = Notification.permission;
      if (permission === 'denied') return;

      if (permission === 'default') {
        showPushPermissionBanner();
        return;
      }

      // Already granted — subscribe straight away.
      await subscribeToPush(reg, pub);
    } catch (err) {
      console.error('[push-init] init error:', err);
    }
  }

  function showPushPermissionBanner() {
    if (sessionStorage.getItem('push_banner_shown')) return;
    if (document.getElementById('push-permission-banner')) return;
    sessionStorage.setItem('push_banner_shown', '1');

    const banner = document.createElement('div');
    banner.id = 'push-permission-banner';
    banner.innerHTML = `
      <div style="position:fixed; bottom:80px; right:16px; left:16px; z-index:8000;
                  background:#1A5C3A; border-radius:16px; padding:14px 16px;
                  display:flex; align-items:center; gap:12px; direction:rtl;
                  box-shadow:0 4px 20px rgba(13,46,30,0.3); font-family:'Vazirmatn',sans-serif;
                  max-width:560px; margin-inline:auto;">
        <div style="font-size:24px;">🔔</div>
        <div style="flex:1;">
          <div style="color:white; font-weight:700; font-size:14px; margin-bottom:2px;">
            اطلاع‌رسانی فعال کنید
          </div>
          <div style="color:rgba(255,255,255,0.75); font-size:12px; line-height:1.6;">
            از وضعیت اشتراک و احراز هویت خود باخبر شوید
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
          <button type="button" onclick="requestPushPermission()"
                  style="background:#F0B429; border:none; border-radius:8px;
                         padding:6px 14px; font-size:12px; font-weight:700;
                         color:#0D2E1E; cursor:pointer; font-family:'Vazirmatn',sans-serif;">
            فعال‌سازی
          </button>
          <button type="button" onclick="dismissPushBanner()"
                  style="background:rgba(255,255,255,0.15); border:none; border-radius:8px;
                         padding:6px 14px; font-size:12px; color:white;
                         cursor:pointer; font-family:'Vazirmatn',sans-serif;">
            نه ممنون
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    // Auto-dismiss after 8s so it doesn't linger forever.
    setTimeout(() => dismissPushBanner(), 8000);
  }

  async function requestPushPermission() {
    dismissPushBanner();
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch('/api/push/vapid-public-key', { credentials: 'include' });
      if (!res.ok) return;
      const { publicKey } = await res.json();
      if (!publicKey) return;
      await subscribeToPush(reg, publicKey);
    } catch (err) {
      console.error('[push-init] requestPushPermission failed:', err);
    }
  }

  function dismissPushBanner() {
    const banner = document.getElementById('push-permission-banner');
    if (banner) banner.remove();
  }

  async function subscribeToPush(reg, publicKey) {
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await syncSubscription(subscription);
  }

  async function syncSubscription(subscription) {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth:   arrayBufferToBase64(subscription.getKey('auth')),
          },
          userAgent: navigator.userAgent,
        }),
      });
    } catch (err) {
      console.error('[push-init] syncSubscription failed:', err);
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
    return output;
  }

  function arrayBufferToBase64(buffer) {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  // Defer until window load so it never competes with critical render work.
  if (document.readyState === 'complete') {
    setTimeout(initPushNotifications, 0);
  } else {
    window.addEventListener('load', initPushNotifications);
  }
})();
