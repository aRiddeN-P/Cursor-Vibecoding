/**
 * support-chat.js — Phase 3-E
 *
 * Goftino live-chat integration. Behaviour:
 *
 *   • The Goftino bootstrap <script> in profile.html loads asynchronously.
 *     We never let its default floating bubble appear (hasIcon: false).
 *   • When the user taps "پشتیبانی آنلاین" in the profile, we open a
 *     fullscreen Dakhlyar-branded overlay and call Goftino.open() so the
 *     widget renders inside that overlay.
 *   • Identity is forwarded to Goftino via setUser the first time the
 *     widget is ready (fetched from /api/profile).
 *   • While the overlay is closed, an unread badge on the row counts
 *     operator messages from `goftino_getMessage`.
 *   • Closing the widget (from either side) hides the overlay.
 *
 * Public API (window):
 *   openSupportChat()    — open overlay + Goftino.open()
 *   closeSupportChat()   — hide overlay + Goftino.close()
 *   clearSupportBadge()  — reset unread badge
 */
(function () {
  'use strict';

  // ── Debug logging (toggle with localStorage.setItem('dakhlyar_chat_debug','1')) ──
  const DEBUG = (function () {
    try { return localStorage.getItem('dakhlyar_chat_debug') === '1'; }
    catch (_) { return false; }
  })();
  const log = (...a) => { if (DEBUG) console.log('[support-chat]', ...a); };
  const warn = (...a) => console.warn('[support-chat]', ...a);

  // ── State ────────────────────────────────────────────────────────────
  let goftinoReady = false;
  let userPayload  = null;
  let userPromise  = null;
  let blockedDetected = false;        // SDK didn't load in time
  let goftinoKey = null;              // resolved from /api/config/public
  let loaderPromise = null;           // dedup concurrent loader calls
  let loaderError = null;             // last fetch/load error (if any)

  log('script loaded. window.Goftino =', typeof window.Goftino);

  // ── Dynamic Goftino widget loader ────────────────────────────────────
  // Replaces the previous hard-coded <script> bootstrap. The widget key
  // now comes from GET /api/config/public (env-driven). We re-try lazily
  // when the user taps the support row if the first attempt failed.
  function loadGoftinoWidget() {
    if (loaderPromise) return loaderPromise;
    loaderPromise = (async () => {
      let cfg;
      try {
        const res = await fetch('/api/config/public', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('config HTTP ' + res.status);
        cfg = await res.json();
      } catch (err) {
        loaderError = err;
        warn('failed to fetch /api/config/public:', err && err.message);
        loaderPromise = null;          // allow retry on next user tap
        throw err;
      }
      const key = cfg && cfg.goftino_key;
      if (!key) {
        const err = new Error('GOFTINO_WIDGET_KEY not configured on server');
        loaderError = err;
        warn(err.message);
        loaderPromise = null;
        throw err;
      }
      goftinoKey = key;

      // Replicate the official Goftino snippet, with the key from config.
      return new Promise((resolve, reject) => {
        try {
          const d = document;
          const g = d.createElement('script');
          const s = 'https://www.goftino.com/widget/' + key;
          let l = null;
          try { l = localStorage.getItem('goftino_' + key); } catch (_) {}
          g.type = 'text/javascript';
          g.async = true;
          g.src = l ? s + '?o=' + l : s;
          g.onload  = () => { log('Goftino widget script loaded for key', key); resolve(key); };
          g.onerror = () => {
            blockedDetected = true;
            const err = new Error('widget script blocked / failed to load');
            loaderError = err;
            warn(err.message);
            reject(err);
          };
          d.getElementsByTagName('head')[0].appendChild(g);
        } catch (err) {
          loaderError = err;
          reject(err);
        }
      });
    })();
    return loaderPromise;
  }

  // Kick off the loader as soon as this script runs.
  loadGoftinoWidget().catch(() => { /* failure handled in openSupportChat */ });

  // Sanity probe — if Goftino never loads (CSP / adblocker / 3rd-party
  // cookies blocked), tell the user clearly instead of just spinning forever.
  setTimeout(() => {
    if (goftinoReady) return;
    if (typeof window.Goftino === 'undefined') {
      blockedDetected = true;
      const k = goftinoKey || 'unknown';
      warn('Goftino SDK did NOT load after 8s — likely blocked by an adblocker, ' +
           'VPN ad-filter, or strict browser privacy mode. Open DevTools → ' +
           'Network and look for a (failed) request to www.goftino.com/widget/' + k);
    } else if (typeof window.Goftino === 'object') {
      log('Goftino SDK loaded but goftino_ready event never fired. Goftino keys:',
          Object.keys(window.Goftino));
    }
  }, 8000);

  // Persian helper text — copy lives here so it's easy to translate later.
  const COPY = Object.freeze({
    blockedTitle: 'پشتیبانی آنلاین در دسترس نیست',
    blockedBody: 'برای استفاده از پشتیبانی آنلاین، لطفاً VPN خود را خاموش کنید و دوباره تلاش نمایید.',
    loadingTitle: 'پشتیبانی آنلاین',
    loadingBody:  'پشتیبانی در حال بارگذاری است. لحظه‌ای صبر کنید.',
  });

  // ── Helpers ──────────────────────────────────────────────────────────
  function toPersianDigits(n) {
    return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }

  function getVerificationLevelLabel(level) {
    const labels = { 0: 'پایه', 1: 'سطح ۱', 2: 'سطح ۲', 3: 'سطح ۳' };
    return labels[level] || 'پایه';
  }

  function getPlanName(plan) {
    const names = { silver: 'نقره‌ای', gold: 'طلایی', diamond: 'الماسی' };
    return names[plan] || (plan || 'ندارد');
  }

  // ── VPN detection — shared module (public/js/vpn-detect.js) ─────────
  async function detectVPN() {
    if (window.DakhlyarVpnDetect && typeof window.DakhlyarVpnDetect.detect === 'function') {
      return window.DakhlyarVpnDetect.detect();
    }
    return { isVPN: false };
  }

  function fetchProfile() {
    if (userPayload) return Promise.resolve(userPayload);
    // Prefer the globally-shared user from profile.js (no extra HTTP call).
    if (window.__dakhlyarUser) {
      userPayload = window.__dakhlyarUser;
      return Promise.resolve(userPayload);
    }
    if (userPromise) return userPromise;
    userPromise = fetch('/api/profile', {
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // /api/profile returns the user fields directly (not nested under .user)
        userPayload = (d && d.user) ? d.user : d || null;
        if (userPayload) {
          try { window.__dakhlyarUser = userPayload; } catch (_) {}
        }
        return userPayload;
      })
      .catch(() => null);
    return userPromise;
  }

  function applyUserToGoftino() {
    if (!window.Goftino || typeof window.Goftino.setUser !== 'function') return;
    fetchProfile().then((u) => {
      if (!u) return;
      const name = (u.first_name && u.last_name)
        ? `${u.first_name} ${u.last_name}`
        : (u.first_name || u.last_name || 'کاربر دخلیار');
      try {
        window.Goftino.setUser({
          email: u.email || '',
          name,
          phone: u.mobile || '',
          about:
            'سطح احراز: ' + getVerificationLevelLabel(u.verification_level) +
            ' | اشتراک: ' + (u.subscription_plan ? getPlanName(u.subscription_plan) : 'ندارد'),
          avatar: u.avatar_url || '',
          metadata: [
            { key: 'user-id',            value: String(u.id) },
            { key: 'verification-level', value: String(u.verification_level ?? 0) },
            { key: 'subscription',       value: u.subscription_plan || 'none' },
            { key: 'mobile',             value: u.mobile || '' },
          ],
          forceUpdate: true,
        });
      } catch (err) {
        console.warn('[support-chat] setUser failed:', err);
      }
    });
  }

  function hideLoading() {
    const el = document.getElementById('support-loading');
    if (el) el.style.display = 'none';
  }

  function showLoading() {
    const el = document.getElementById('support-loading');
    if (el && !goftinoReady) el.style.display = 'flex';
  }

  // ── Badge helpers ────────────────────────────────────────────────────
  function bumpBadge() {
    const badge = document.getElementById('support-unread');
    if (!badge) return;
    const current = parseInt(badge.getAttribute('data-count') || '0', 10) || 0;
    const next = current + 1;
    badge.setAttribute('data-count', String(next));
    badge.textContent = toPersianDigits(next > 99 ? '۹۹+' : next);
    badge.style.display = 'inline-flex';
  }

  function clearSupportBadge() {
    const badge = document.getElementById('support-unread');
    if (!badge) return;
    badge.setAttribute('data-count', '0');
    badge.textContent = '۰';
    badge.style.display = 'none';
  }

  // ── Overlay open/close ───────────────────────────────────────────────
  function overlayEl() { return document.getElementById('support-chat-overlay'); }
  const OPEN_CLASS = 'support-chat-open';

  function isOverlayOpen() {
    const o = overlayEl();
    return !!(o && o.style.display === 'flex');
  }

  // Some Goftino layouts render as a centered card with fixed width. On small
  // screens this looks like two stacked layers (our overlay + Goftino card).
  // While support is open we force Goftino roots/iframes to fullscreen.
  function enforceFullScreenNode(node, z) {
    if (!node || !node.style) return;
    node.style.position = 'fixed';
    node.style.top = '0';
    node.style.right = '0';
    node.style.bottom = '0';
    node.style.left = '0';
    node.style.width = '100vw';
    node.style.minWidth = '100vw';
    node.style.maxWidth = '100vw';
    node.style.height = '100dvh';
    node.style.minHeight = '100dvh';
    node.style.maxHeight = '100dvh';
    node.style.margin = '0';
    node.style.borderRadius = '0';
    node.style.transform = 'none';
    node.style.zIndex = String(z);
  }

  function normalizeGoftinoLayout() {
    if (!isOverlayOpen()) return;
    const nodes = Array.from(document.querySelectorAll(
      'iframe[src*="goftino"], [id*="goftino"], [class*="goftino"]'
    ));
    if (!nodes.length) {
      log('normalizeGoftinoLayout: no goftino nodes yet');
      return;
    }
    nodes.forEach((el) => {
      // Push iframe and obvious root containers to fullscreen.
      const key = ((el.id || '') + ' ' + (el.className || '')).toLowerCase();
      const isFrame = el.tagName === 'IFRAME';
      const isRootLike = key.includes('widget') || key.includes('iframe') || key.includes('chat');
      if (isFrame || isRootLike) {
        enforceFullScreenNode(el, 9002);
      }
      // Also normalize fixed-position ancestors that often hold width caps.
      let p = el.parentElement;
      for (let i = 0; i < 4 && p; i += 1) {
        const st = window.getComputedStyle(p);
        if (st.position === 'fixed' || st.position === 'absolute') {
          enforceFullScreenNode(p, 9001);
        }
        p = p.parentElement;
      }
    });
  }

  function openChatOverlayAndWidget() {
    clearSupportBadge();
    const o = overlayEl();
    if (o) {
      o.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      document.body.classList.add(OPEN_CLASS);
    }
    window.Goftino && window.Goftino.open && window.Goftino.open();
    // Goftino builds parts of DOM asynchronously; normalize a few times.
    setTimeout(normalizeGoftinoLayout, 350);
    setTimeout(normalizeGoftinoLayout, 850);
    setTimeout(normalizeGoftinoLayout, 1500);
  }

  async function openSupportChat() {
    log('openSupportChat called. goftinoReady=', goftinoReady,
        'blockedDetected=', blockedDetected, 'window.Goftino=', typeof window.Goftino);

    // If the previous loader attempt failed (e.g. /api/config/public was
    // briefly unreachable), retry NOW on user gesture.
    if (loaderError || (!loaderPromise && typeof window.Goftino === 'undefined')) {
      try { await loadGoftinoWidget(); loaderError = null; }
      catch (_) { /* fall through — handled by the "not ready" branch below */ }
    }

    if (!goftinoReady) {
      // Kick off profile fetch in parallel so by the time user retries it's warm.
      fetchProfile();
      const isBlocked = blockedDetected || typeof window.Goftino === 'undefined';
      if (window.DakhlyarModal && typeof window.DakhlyarModal.alert === 'function') {
        window.DakhlyarModal.alert({
          title:   isBlocked ? COPY.blockedTitle : COPY.loadingTitle,
          message: isBlocked ? COPY.blockedBody  : COPY.loadingBody,
          subType: isBlocked ? 'warning' : 'info',
        });
      }
      return;
    }

    let loadingToken = null;
    try {
      // VPN check loading state
      if (window.DakhlyarModal && typeof window.DakhlyarModal.loading === 'function') {
        loadingToken = window.DakhlyarModal.loading({ message: 'در حال بررسی اتصال...' });
      }

      const result = await detectVPN();
      log('VPN detection result:', result);

      if (loadingToken && window.DakhlyarModal && typeof window.DakhlyarModal.closeLoading === 'function') {
        window.DakhlyarModal.closeLoading(loadingToken);
        loadingToken = null;
      }

      if (result && result.isVPN) {
        if (window.DakhlyarModal && typeof window.DakhlyarModal.alert === 'function') {
          window.DakhlyarModal.alert({
            title: (window.DakhlyarVpnDetect && window.DakhlyarVpnDetect.COPY.title) || 'اتصال VPN شناسایی شد',
            message: COPY.blockedBody,
            subType: 'error',
            confirmText: 'متوجه شدم',
          });
        }
        return;
      }

      openChatOverlayAndWidget();
      log('Goftino.open() called. Searching DOM for Goftino iframe…');
      // Diagnostic: most chat SDKs append an iframe to <body>. If we can find
      // it, we can later re-parent / re-style it.
      setTimeout(() => {
        const ifr = document.querySelector('iframe[src*="goftino"], iframe[id*="goftino"], div[id*="goftino"]');
        log('Goftino DOM element found?', !!ifr, ifr && (ifr.tagName + '#' + ifr.id));
        normalizeGoftinoLayout();
      }, 400);
    } catch (e) {
      // Fail-open policy: detection errors should not block legitimate users.
      if (loadingToken && window.DakhlyarModal && typeof window.DakhlyarModal.closeLoading === 'function') {
        window.DakhlyarModal.closeLoading(loadingToken);
      }
      log('VPN detection failed, fail-open:', e && e.message ? e.message : e);
      openChatOverlayAndWidget();
    }
  }

  function closeSupportChat() {
    const o = overlayEl();
    if (o) o.style.display = 'none';
    document.body.style.overflow = '';
    document.body.classList.remove(OPEN_CLASS);
    try { window.Goftino && window.Goftino.close && window.Goftino.close(); } catch (_) {}
  }

  // ── Goftino events ───────────────────────────────────────────────────
  window.addEventListener('goftino_ready', function () {
    log('goftino_ready event fired. Goftino API:', window.Goftino && Object.keys(window.Goftino));
    try {
      window.Goftino.setWidget({
        hasIcon: false,        // never show the default floating bubble
        hasSound: true,
        marginRight: 0,
        marginLeft: 0,
        marginBottom: 0,
      });
      log('setWidget done');
    } catch (e) {
      warn('setWidget failed:', e);
    }
    applyUserToGoftino();
    goftinoReady = true;
    hideLoading();
  });

  window.addEventListener('goftino_closeWidget', function () {
    const o = overlayEl();
    if (o) o.style.display = 'none';
    document.body.style.overflow = '';
    document.body.classList.remove(OPEN_CLASS);
  });

  window.addEventListener('goftino_getMessage', function () {
    // Only count when overlay is hidden — operator typed while user was away.
    if (!isOverlayOpen()) bumpBadge();
  });

  // ── Wire row clicks ──────────────────────────────────────────────────
  function wireRowClicks() {
    document.querySelectorAll('[data-support-chat]').forEach((el) => {
      // Replace any existing listener bound to navigation; this row no
      // longer has data-go, so profile.js delegation won't touch it.
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openSupportChat();
      });
    });
    // Show loading state if user opens overlay before Goftino fires ready.
    showLoading();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireRowClicks);
  } else {
    wireRowClicks();
  }
  window.addEventListener('resize', normalizeGoftinoLayout);

  // ── Public API (also used by inline onclick in the subview fallback) ─
  window.openSupportChat   = openSupportChat;
  window.closeSupportChat  = closeSupportChat;
  window.clearSupportBadge = clearSupportBadge;
})();
