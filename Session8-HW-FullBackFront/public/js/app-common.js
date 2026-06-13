/**
 * app-common.js — Phase 4
 *
 * Shared client helpers loaded by every Phase-4 page:
 *
 *   • toPersianDigits()   — global digit converter
 *   • updateMessageBadge — keeps the `#msg-badge` element in the page header
 *     in sync with the user's unread message count (polled every 60s while
 *     the page is open). Silently no-ops when the element isn't present.
 */
(function () {
  'use strict';

  function toPersianDigits(n) {
    return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }
  // Expose globally — many pages call it directly.
  window.toPersianDigits = toPersianDigits;

  // Phase 5 — currency formatting (Toman only for now).
  function formatToman(amount) {
    if (amount === null || amount === undefined || amount === '') return '۰';
    const n = Number(amount);
    if (!Number.isFinite(n)) return '۰';
    return toPersianDigits(Math.trunc(n).toLocaleString('en'));
  }
  function formatTomanShort(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '۰';
    if (n >= 1_000_000_000) return toPersianDigits((n / 1_000_000_000).toFixed(1)) + ' میلیارد';
    if (n >= 1_000_000)     return toPersianDigits((n / 1_000_000).toFixed(1))     + ' میلیون';
    if (n >= 1_000)         return toPersianDigits((n / 1_000).toFixed(0))         + ' هزار';
    return toPersianDigits(String(Math.trunc(n)));
  }
  window.formatToman = formatToman;
  window.formatTomanShort = formatTomanShort;

  // Phase 5 — lightweight non-blocking toast.
  // type ∈ {'success' | 'error' | 'info'}.
  function ensureToastStyles() {
    if (document.getElementById('dakhlyar-toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'dakhlyar-toast-styles';
    style.textContent = `
      @keyframes toastIn  { from { opacity:0; transform: translateX(-50%) translateY(-8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
      @keyframes toastOut { from { opacity:1; } to { opacity:0; } }
    `;
    document.head.appendChild(style);
  }
  function showToast(message, type = 'success') {
    ensureToastStyles();
    const existing = document.getElementById('dakhlyar-toast');
    if (existing) existing.remove();

    const colors = {
      success: { bg: '#ECFDF5', border: '#1A5C3A', text: '#1A5C3A' },
      error:   { bg: '#FEF2F2', border: '#DC2626', text: '#DC2626' },
      info:    { bg: '#EFF6FF', border: '#2563EB', text: '#2563EB' },
    };
    const c = colors[type] || colors.success;

    const toast = document.createElement('div');
    toast.id = 'dakhlyar-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = `
      position: fixed; top: 72px; left: 50%; transform: translateX(-50%);
      z-index: 9999; background: ${c.bg};
      border: 1px solid ${c.border}; border-radius: 12px;
      padding: 10px 20px; font-size: 14px; font-weight: 600;
      color: ${c.text}; font-family: 'Vazirmatn', sans-serif;
      max-width: calc(100vw - 32px); direction: rtl; text-align: center;
      animation: toastIn 200ms ease;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 200ms ease forwards';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }
  window.showToast = showToast;

  async function updateMessageBadge() {
    const badge = document.getElementById('msg-badge');
    if (!badge) return;
    try {
      const res = await fetch('/api/messages', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      const count = (data && data.unread_count) || 0;
      if (count > 0) {
        badge.textContent = count > 99 ? '+۹۹' : toPersianDigits(count);
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    } catch (_) {
      // silent — badge stays in whatever state it was
    }
  }
  window.updateMessageBadge = updateMessageBadge;

  function start() {
    updateMessageBadge();
    setInterval(updateMessageBadge, 60 * 1000);
    pingSession();
    setInterval(pingSession, 2 * 60 * 1000);
  }

  async function pingSession() {
    try {
      await fetch('/api/session/ping', { method: 'POST', credentials: 'same-origin' });
    } catch (_) {
      // silent — user may not be logged in
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(start, 0);
  } else {
    window.addEventListener('load', start);
  }
})();
