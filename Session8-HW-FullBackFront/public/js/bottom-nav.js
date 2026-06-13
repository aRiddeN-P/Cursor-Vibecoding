/**
 * bottom-nav.js — Phase 4
 *
 * Reusable bottom navigation injected into the body of every Phase-4 page.
 * Uses inline styles + an id-selector (#bottom-nav) so it never conflicts
 * with legacy CSS classes (e.g. profile.css already defines .bottom-nav).
 *
 * Tab order in the DOM is RTL — the array below is in RIGHT-to-LEFT visual
 * order so the first item appears on the FAR RIGHT (which is the natural
 * "home" position in RTL layouts).
 *
 * Locked tabs (`expert`, `assets`) show a lock badge AND, on tap, open a
 * DakhlyarModal that nudges the user to the subscription page. If the user
 * already has an active subscription the lock is removed entirely.
 *
 * Usage on each page:
 *   <script src="/js/modal.js"></script>
 *   <script src="/js/bottom-nav.js"></script>
 *   <script>DakhlyarNav.init('transactions');</script>
 */
(function () {
  'use strict';

  // RTL order: index 0 → far RIGHT (home), last item → far LEFT (assets).
  const TABS = [
    { id: 'home',         label: 'خانه',            icon: 'ti-home',            href: '/dashboard.html',    locked: false },
    { id: 'transactions', label: 'تراکنش‌ها',         icon: 'ti-arrows-exchange', href: '/transactions.html', locked: false },
    { id: 'reports',      label: 'گزارشات',          icon: 'ti-chart-bar',       href: '/reports.html',      locked: false },
    { id: 'market',       label: 'نمای بازار',        icon: 'ti-trending-up',     href: '/market.html',       locked: false },
    { id: 'expert',       label: 'پیشنهاد تخصصی',    icon: 'ti-bulb',            href: '/expert.html',       locked: true  },
    { id: 'assets',       label: 'دارایی‌ها',         icon: 'ti-wallet',          href: '/assets.html',       locked: true  },
  ];

  function renderBottomNav(activeTab, userHasSubscription) {
    // Avoid duplicate render if init is called twice on the same page.
    const existing = document.getElementById('bottom-nav');
    if (existing) existing.remove();

    const nav = document.createElement('nav');
    nav.id = 'bottom-nav';
    nav.setAttribute('dir', 'rtl');
    nav.setAttribute('aria-label', 'ناوبری اصلی');
    nav.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000;
      background: #ffffff; border-top: 0.5px solid #E8EAF0;
      display: flex; align-items: stretch; justify-content: space-around;
      height: 64px; padding: 0 4px;
      padding-bottom: env(safe-area-inset-bottom);
      font-family: 'Vazirmatn', sans-serif;
    `;

    TABS.forEach((tab) => {
      const isActive = tab.id === activeTab;
      const isLocked = tab.locked && !userHasSubscription;
      const fg = isActive ? '#1A5C3A' : '#9CA3AF';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.navId = tab.id;
      btn.setAttribute('aria-label', tab.label + (isLocked ? ' — قفل' : ''));
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
      btn.style.cssText = `
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 3px; flex: 1; height: 100%;
        background: none; border: none; cursor: pointer; position: relative;
        color: ${fg}; padding: 6px 2px;
        font-family: inherit; transition: color 0.15s;
      `;

      if (isActive) {
        const dot = document.createElement('div');
        dot.setAttribute('aria-hidden', 'true');
        dot.style.cssText = `
          position: absolute; top: 4px;
          width: 4px; height: 4px; border-radius: 50%;
          background: #1A5C3A;
        `;
        btn.appendChild(dot);
      }

      const iconWrap = document.createElement('div');
      iconWrap.style.cssText = 'position: relative; display: inline-flex;';

      const icon = document.createElement('i');
      icon.className = 'ti ' + tab.icon;
      icon.style.cssText = 'font-size: 22px; line-height: 1;';
      iconWrap.appendChild(icon);

      if (isLocked) {
        const lock = document.createElement('span');
        lock.setAttribute('aria-hidden', 'true');
        lock.style.cssText = `
          position: absolute; top: -4px; left: -4px;
          background: #F0B429; color: #0D2E1E; border-radius: 50%;
          width: 14px; height: 14px;
          display: flex; align-items: center; justify-content: center;
        `;
        lock.innerHTML = '<i class="ti ti-lock" style="font-size:8px; line-height:1;"></i>';
        iconWrap.appendChild(lock);
      }

      const label = document.createElement('span');
      label.textContent = tab.label;
      label.style.cssText = `font-size: 10px; font-weight: ${isActive ? '700' : '400'};`;

      btn.appendChild(iconWrap);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        if (isLocked) {
          if (window.DakhlyarModal && typeof window.DakhlyarModal.confirm === 'function') {
            window.DakhlyarModal.confirm({
              title: 'دسترسی محدود',
              message: 'این بخش مخصوص کاربران دارای اشتراک فعال است. برای دسترسی اشتراک تهیه کنید.',
              confirmText: 'خرید اشتراک',
              cancelText: 'بستن',
              subType: 'info',
              onConfirm: () => { window.location.href = '/profile.html#subscription'; },
            });
          } else {
            // Modal not loaded — fall back to native confirm.
            // eslint-disable-next-line no-alert
            if (confirm('این بخش مخصوص کاربران دارای اشتراک فعال است. خرید اشتراک؟')) {
              window.location.href = '/profile.html#subscription';
            }
          }
          return;
        }
        if (isActive) return; // no-op for active tab
        window.location.href = tab.href;
      });

      nav.appendChild(btn);
    });

    document.body.appendChild(nav);
    // Ensure content isn't hidden behind the fixed nav.
    if (!document.body.style.paddingBottom) {
      document.body.style.paddingBottom = '80px';
    }
  }

  async function initBottomNav(activeTab) {
    let hasSubscription = false;
    try {
      const res = await fetch('/api/subscription/status', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        hasSubscription = data && data.is_active === true;
      }
    } catch (_) { /* leave hasSubscription = false */ }
    renderBottomNav(activeTab, hasSubscription);
  }

  window.DakhlyarNav = {
    init: initBottomNav,
    render: renderBottomNav,
    TABS: TABS,
  };
})();
