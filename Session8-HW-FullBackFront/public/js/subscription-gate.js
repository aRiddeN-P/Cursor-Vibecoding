/**
 * subscription-gate.js — Phase 4
 *
 * Front-end gate for "subscription-only" pages (expert.html, assets.html).
 * Calls /api/subscription/status and either invokes `onGranted` or renders
 * a locked screen inside the supplied container.
 *
 * Server-side endpoints will still enforce subscription rules on actual API
 * calls; this is purely a UX guard so we don't show empty/half-rendered UIs
 * to users without a paid plan.
 *
 * Usage:
 *   <script src="/js/subscription-gate.js"></script>
 *   <script>
 *     checkSubscriptionGate(
 *       () => renderMyPage(),
 *       () => showLockedScreen(document.getElementById('main-content'), 'پیشنهاد تخصصی')
 *     );
 *   </script>
 */
(function () {
  'use strict';

  async function checkSubscriptionGate(onGranted, onDenied) {
    try {
      const res = await fetch('/api/subscription/status', { credentials: 'same-origin' });
      if (res.status === 401) {
        window.location.href = '/';
        return;
      }
      if (!res.ok) {
        onDenied();
        return;
      }
      const data = await res.json();
      if (data && data.is_active === true) {
        onGranted();
      } else {
        onDenied();
      }
    } catch (_) {
      onDenied();
    }
  }

  function showLockedScreen(containerEl, pageName) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div class="dk-locked" style="display:flex; flex-direction:column; align-items:center;
                  justify-content:center; min-height:60vh; text-align:center;
                  gap:16px; padding:32px;">
        <div style="width:80px; height:80px; border-radius:50%;
                    background:var(--color-surface, #ECFDF5);
                    display:flex; align-items:center; justify-content:center;">
          <i class="ti ti-lock" style="font-size:36px; color:var(--color-primary, #1A5C3A);"></i>
        </div>
        <h2 style="font-size:18px; font-weight:700; color:var(--color-text-1, #0D2E1E); margin:0;">
          ${pageName || ''}
        </h2>
        <p style="font-size:14px; color:var(--color-text-2, #4B5563); line-height:1.7; max-width:280px; margin:0;">
          این بخش مخصوص کاربران دارای اشتراک فعال است.
          با خرید اشتراک به امکانات پیشرفته دسترسی داشته باشید.
        </p>
        <button type="button" class="btn-primary" style="max-width:240px;"
                onclick="window.location.href='/profile.html#subscription'">
          خرید اشتراک
        </button>
        <button type="button" class="btn-secondary" style="max-width:240px;"
                onclick="window.history.length > 1 ? window.history.back() : (window.location.href='/dashboard.html')">
          بازگشت
        </button>
      </div>
    `;
  }

  window.checkSubscriptionGate = checkSubscriptionGate;
  window.showLockedScreen = showLockedScreen;
})();
