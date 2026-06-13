/**
 * profile.js — Phase 3
 *
 * Hash-routed single-page profile (`/profile.html#/info`, `#/devices`, …).
 * Sub-views:
 *   home          → main hub
 *   info          → editable user fields (verification-level aware locking)
 *   verification  → 4-level stepper + request CTA
 *   subscription  → plans or active card
 *   devices       → connected devices list with delete
 *   invite        → invite code + copy
 *   faq           → static FAQ
 *   terms         → static terms (rendered in HTML)
 *   support       → coming-soon shell
 */
(function () {
  'use strict';

  // ====================== helpers ======================

  const $  = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const toFa = (str) => String(str ?? '').replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
  // Normalize Persian (۰-۹ / U+06F0-U+06F9) AND Arabic-Indic (٠-٩ / U+0660-U+0669)
  // digits to ASCII. Without the second range, IME / Persian-Arabic keyboards
  // produce characters that look like digits but fail the [0-9] regexes,
  // making fields like postal_code & national_id silently un-saveable.
  const toEn = (str) =>
    String(str ?? '')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
  const POSTAL_REGEX = /^[0-9]{10}$/;
  const NATIONAL_ID_REGEX = /^[0-9]{10}$/;

  let toastTimer = null;
  function toast(message, ms = 2400) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms);
  }

  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, Object.assign({
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    }, opts));
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { status: res.status, ok: res.ok, data: data || {} };
  }

  function formatToman(n) {
    if (n == null) return '—';
    const formatted = Number(n).toLocaleString('en-US').replace(/,/g, '٬');
    return `${toFa(formatted)} تومان`;
  }

  // Shared Jalali date helpers come from /js/date-fa.js (loaded before this file).
  // `formatJalali` is kept as a local alias so the rest of this file reads cleanly,
  // and so existing callsites for "date-only" rendering keep their semantics.
  const formatJalali = (iso) => window.formatJalaliDate(iso);
  const formatDate   = (iso) => window.formatJalaliDate(iso);     // YYYY/MM/DD Jalali
  const formatDateTime = (iso) => window.formatJalaliDateTime(iso); // + HH:MM

  // ====================== state ======================

  /** @type {object|null} */ let me = null;
  /** @type {object|null} */ let verifData = null;
  /** @type {object|null} */ let subData = null;

  // ====================== routing ======================

  const VALID_VIEWS = ['home', 'info', 'verification', 'subscription', 'devices', 'invite', 'faq', 'terms', 'support'];

  function currentView() {
    const hash = location.hash.replace(/^#\/?/, '');
    return VALID_VIEWS.includes(hash) ? hash : 'home';
  }

  async function activateView(name) {
    $$('.subview').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (name === 'info')         { await ensureMe();   renderInfoFields(); }
    if (name === 'verification') { await loadVerif();  renderVerifList(); }
    if (name === 'subscription') { await loadSub();    renderSubscriptionView(); }
    if (name === 'devices')      { await loadDevices(); }
    if (name === 'invite')       { await loadInvite(); }
    if (name === 'faq')          { renderFaq(); }
  }

  function go(view) {
    if (view === 'home') location.hash = '';
    else location.hash = `#/${view}`;
  }

  window.addEventListener('hashchange', () => activateView(currentView()));

  // Click handlers for [data-go] buttons
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go]');
    if (!t) return;
    const view = t.dataset.go;
    if (view === 'home') {
      // home buttons in sub-views = "back to hub"
      go('home');
    } else {
      go(view);
    }
  });

  $('#backToDash')?.addEventListener('click', () => { location.href = '/dashboard.html'; });

  // ====================== /api/profile loading ======================

  async function ensureMe(forceRefresh = false) {
    if (me && !forceRefresh) return me;
    const r = await fetchJson('/api/profile');
    if (r.status === 401) { location.href = '/'; throw new Error('no session'); }
    if (!r.ok) { toast(r.data.message || 'خطا در بارگذاری پروفایل'); throw new Error('profile fetch failed'); }
    me = r.data;
    // Expose the user payload globally so other modules (e.g. Goftino
    // support-chat.js) can pick it up without re-fetching /api/profile.
    try { window.__dakhlyarUser = me; } catch (_) { /* sealed window */ }
    renderHero();
    renderRowSummaries();
    return me;
  }

  function renderHero() {
    if (!me) return;
    const name = ((me.first_name || '') + ' ' + (me.last_name || '')).trim();
    $('#userName').textContent = name || 'کاربر دخلیار';
    $('#userMobile').textContent = me.mobile ? toFa(me.mobile) : '—';

    // Avatar image — server already gave us the resolved URL.
    const avatarImg = $('#userAvatar');
    if (avatarImg) {
      const url = me.avatar_url || (window.getAvatarUrl ? window.getAvatarUrl(me) : '');
      if (url) avatarImg.src = url;
      avatarImg.alt = name || 'آواتار';
    }

    const badge = $('#subBadge');
    badge.classList.remove('none', 'silver', 'gold', 'diamond');
    if (me.is_subscription_active && me.subscription_plan) {
      badge.classList.add(me.subscription_plan);
      badge.textContent = me.subscription_plan_name || '';
    } else {
      badge.classList.add('none');
      badge.textContent = 'بدون اشتراک';
    }
  }

  // ---- Avatar picker integration ----
  let _avatarPicker = null;
  function getAvatarPicker() {
    if (_avatarPicker) return _avatarPicker;
    if (typeof window.AvatarPicker !== 'function') return null;
    _avatarPicker = new window.AvatarPicker({
      toast: toast,
      onChange: (url, meta) => {
        // Reflect the new avatar in the hero immediately.
        const img = $('#userAvatar');
        if (img) img.src = url;
        if (me) {
          me.avatar_url = url;
          me.avatar_type = meta.type;
          me.avatar_seed = meta.seed;
        }
      },
      onSubscriptionCta: () => { go('subscription'); },
    });
    return _avatarPicker;
  }

  document.addEventListener('click', (e) => {
    const trg = e.target.closest('#userAvatar');
    if (!trg) return;
    const p = getAvatarPicker();
    if (p) p.open();
    else toast('آواتار در حال آماده‌سازی است…');
  });

  function renderRowSummaries() {
    if (!me) return;
    const infoBits = [];
    if (me.first_name || me.last_name) infoBits.push(((me.first_name || '') + ' ' + (me.last_name || '')).trim());
    if (me.email)  infoBits.push(me.email);
    if (me.mobile) infoBits.push(toFa(me.mobile));
    $('#rowInfoSummary').textContent = infoBits.length ? infoBits.join(' • ') : 'نام، ایمیل، شماره موبایل';

    const lvl = me.verification_level || 0;
    $('#rowVerifSummary').textContent = `سطح فعلی: ${toFa(lvl)} از ۳`;

    if (me.is_subscription_active) {
      $('#rowSubSummary').textContent = `${me.subscription_plan_name || ''} — فعال`;
    } else {
      $('#rowSubSummary').textContent = 'بدون اشتراک فعال';
    }
  }

  // ====================== Info subview ======================

  const FIELD_META = [
    { key: 'first_name',  label: 'نام',           type: 'text',  lockLevel: null },
    { key: 'last_name',   label: 'نام خانوادگی',  type: 'text',  lockLevel: null },
    { key: 'email',       label: 'ایمیل',         type: 'email', lockLevel: 0    /* always locked */ },
    { key: 'mobile',      label: 'شماره موبایل',  type: 'tel',   lockLevel: 1    },
    { key: 'national_id', label: 'کد ملی',        type: 'text',  lockLevel: 1    },
    { key: 'birth_date',  label: 'تاریخ تولد',    type: 'date',  lockLevel: 2    },
    { key: 'address',     label: 'آدرس',          type: 'text',  lockLevel: 3    },
    { key: 'postal_code', label: 'کدپستی',        type: 'text',  lockLevel: 3    },
  ];

  function isLocked(field) {
    if (!me) return true;
    if (field.key === 'email') return true; // always locked
    if (field.key === 'mobile') return true; // mobile changes are out of scope for Phase 3
    if (field.lockLevel == null) return false;
    return (me.verification_level || 0) >= field.lockLevel;
  }

  function renderInfoFields() {
    const root = $('#infoFields');
    root.innerHTML = '';
    if (!me) return;

    FIELD_META.forEach((field) => {
      const locked = isLocked(field);
      const raw = me[field.key];

      let display = '—';
      if (raw != null && raw !== '') {
        if (field.key === 'birth_date') {
          // Show the Jalali (Shamsi) date with Persian digits.
          display = formatJalali(raw);
        } else if (field.key === 'mobile' || field.key === 'national_id' || field.key === 'postal_code') {
          display = toFa(String(raw));
        } else {
          display = String(raw);
        }
      }

      const row = document.createElement('div');
      row.className = 'field-row';
      row.dataset.field = field.key;
      row.innerHTML = `
        <label>${field.label}</label>
        <div class="value-wrap">
          <div class="value-display">${escapeHtml(display)}</div>
          ${locked
            ? '<span class="lock-icon" title="قابل ویرایش نیست">🔒</span>'
            : '<button class="field-edit-btn">ویرایش</button>'}
        </div>
      `;
      root.appendChild(row);

      if (!locked) {
        row.querySelector('.field-edit-btn').addEventListener('click', () => beginEditField(row, field, raw));
      }
    });
  }

  function beginEditField(row, field, currentValue) {
    const wrap = row.querySelector('.value-wrap');
    wrap.innerHTML = '';
    const input = document.createElement('input');
    input.className = 'field-edit-input';
    // birth_date uses a Persian datepicker → use a text input so the
    // browser doesn't show its own Gregorian date popup.
    input.type = field.key === 'birth_date' ? 'text' : field.type;
    input.value = currentValue == null ? '' : currentValue;
    if (field.key === 'postal_code' || field.key === 'national_id') {
      input.inputMode = 'numeric';
      input.maxLength = 10;
      // Live-strip non-digit chars and convert Persian/Arabic-Indic digits to
      // ASCII as the user types, so what they see is what gets validated.
      input.addEventListener('input', () => {
        const cleaned = toEn(input.value).replace(/[^0-9]/g, '').slice(0, 10);
        if (cleaned !== input.value) input.value = cleaned;
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const txt = (e.clipboardData || window.clipboardData).getData('text');
        input.value = toEn(txt).replace(/[^0-9]/g, '').slice(0, 10);
      });
    }
    if (field.key === 'birth_date') {
      input.placeholder = 'مثلاً ۱۳۶۹/۰۲/۲۲';
      input.dir = 'rtl';
      input.readOnly = true; // value comes only from the date picker
      input.style.cursor = 'pointer';
    }

    const save   = el('button', 'field-save-btn', 'ذخیره');
    const cancel = el('button', 'field-cancel-btn', 'انصراف');
    wrap.appendChild(input);
    wrap.appendChild(save);
    wrap.appendChild(cancel);
    input.focus();
    input.select?.();

    // ---- birth_date: attach the Persian datepicker (Jalali UI, stores Gregorian)
    if (field.key === 'birth_date') {
      const $jq = window.jQuery;
      if ($jq && typeof $jq.fn.persianDatepicker === 'function') {
        // unix-ms timestamp for any existing value (Gregorian)
        const initialUnix = currentValue ? new Date(currentValue + 'T00:00:00').getTime() : null;
        // pre-populate the input with the Shamsi formatted current value
        if (currentValue) input.value = formatJalali(currentValue);
        $jq(input).persianDatepicker({
          format: 'YYYY/MM/DD',
          autoClose: true,
          observer: true,
          initialValue: !!initialUnix,
          initialValueType: 'gregorian',
          calendarType: 'persian',
          persianDigit: true,
          calendar: { persian: { locale: 'fa' } },
          minDate: new Date(Date.now() - 120 * 365.25 * 24 * 60 * 60 * 1000).getTime(),
          maxDate: Date.now(),
          toolbox: { calendarSwitch: { enabled: false } },
          onSelect: (unix) => {
            // store Gregorian YYYY-MM-DD on the input dataset for save
            const d = new Date(unix);
            input.dataset.gregorian = d.toISOString().slice(0, 10);
          },
        });
        // if we already have a value, pre-set the dataset
        if (initialUnix) input.dataset.gregorian = currentValue;
      }
    }

    cancel.addEventListener('click', () => renderInfoFields());
    save.addEventListener('click', async () => {
      let valueToSend;
      if (field.key === 'birth_date') {
        valueToSend = input.dataset.gregorian || (currentValue || '').toString();
        if (!valueToSend) return toast('لطفاً تاریخ را انتخاب کنید');
      } else {
        valueToSend = toEn(input.value || '').trim();
      }

      // client-side checks for nicer feedback
      if (field.key === 'postal_code' && valueToSend && !POSTAL_REGEX.test(valueToSend))      return toast('کدپستی باید ۱۰ رقم عددی باشد');
      if (field.key === 'national_id' && valueToSend && !NATIONAL_ID_REGEX.test(valueToSend)) return toast('کد ملی باید ۱۰ رقم عددی باشد');

      save.disabled = true; cancel.disabled = true;
      const r = await fetchJson('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ [field.key]: valueToSend }),
      });
      save.disabled = false; cancel.disabled = false;

      if (r.ok) {
        toast('اطلاعات با موفقیت بروزرسانی شد');
        await ensureMe(true);
        renderInfoFields();
      } else {
        toast(r.data.message || 'خطا در بروزرسانی');
        if (r.status === 403) {
          // verification has changed since page load → reload
          await ensureMe(true);
          renderInfoFields();
        }
      }
    });
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ====================== Verification subview ======================

  const LEVEL_LABELS = {
    0: { title: 'احراز ایمیل', desc: 'پایه — هنگام ثبت‌نام انجام شده است.' },
    1: { title: 'احراز موبایل و کد ملی', desc: 'برای سطح ۱ باید شماره موبایل و کد ملی شما در پروفایل ثبت شده باشد.' },
    2: { title: 'احراز تاریخ تولد', desc: 'برای سطح ۲ باید تاریخ تولد در پروفایل ثبت شده باشد.' },
    3: { title: 'احراز آدرس و کدپستی', desc: 'برای سطح ۳ باید آدرس و کدپستی در پروفایل ثبت شده باشد.' },
  };

  async function loadVerif() {
    const r = await fetchJson('/api/verification/status');
    if (r.status === 401) { location.href = '/'; return; }
    if (!r.ok) { toast(r.data.message || 'خطا در دریافت وضعیت احراز'); return; }
    verifData = r.data;
  }

  function renderVerifList() {
    const root = $('#verifList');
    root.innerHTML = '';
    if (!verifData) return;

    const lvl0 = document.createElement('div');
    lvl0.className = 'verif-item approved';
    lvl0.innerHTML = `
      <div class="vdot">✓</div>
      <div class="verif-body">
        <h4>${LEVEL_LABELS[0].title}</h4>
        <p>${LEVEL_LABELS[0].desc}</p>
        <span class="verif-status">تایید شده</span>
      </div>`;
    root.appendChild(lvl0);

    verifData.levels.forEach((lvl) => {
      const meta = LEVEL_LABELS[lvl.level];
      const wrap = document.createElement('div');
      wrap.className = `verif-item ${lvl.state}`;
      const title = `${meta.title}  <span class="muted" style="font-weight:normal;font-size:12px">— سطح ${toFa(lvl.level)}</span>`;

      let statusBadge = '';
      let cta = '';
      const isAvailable = lvl.state === 'available' || lvl.state === 'rejected';

      switch (lvl.state) {
        case 'approved':
          statusBadge = '<span class="verif-status">✓ تایید شده</span>';
          break;
        case 'pending':
          statusBadge = '<span class="verif-status">⏳ در انتظار بررسی</span>';
          break;
        case 'rejected':
          statusBadge = `<span class="verif-status">✕ رد شده${lvl.last_request?.admin_note ? ' — ' + escapeHtml(lvl.last_request.admin_note) : ''}</span>`;
          break;
        case 'locked':
          statusBadge = '<span class="verif-status">ابتدا سطح قبلی را احراز کنید</span>';
          break;
        case 'available':
          // no badge — just the CTA
          break;
      }

      if (isAvailable) {
        const missing = lvl.missing_fields || [];
        if (missing.length) {
          // CTA is disabled — show why + a small "complete profile" shortcut.
          const labels = missing.map((f) => ({
            mobile: 'شماره موبایل', national_id: 'کد ملی', birth_date: 'تاریخ تولد',
            postal_code: 'کدپستی', address: 'آدرس',
          }[f] || f)).join('، ');
          cta = `
            <button class="verif-cta" disabled
                    title="ابتدا فیلدهای زیر را در «مشخصات کاربر» تکمیل کنید: ${escapeHtml(labels)}">
              درخواست احراز
            </button>
            <div class="verif-missing-hint">
              برای فعال شدن دکمه، در «مشخصات کاربر» این موارد را تکمیل کنید: <strong>${escapeHtml(labels)}</strong>
              <button class="verif-missing-link" data-go="info">تکمیل اطلاعات</button>
            </div>`;
        } else {
          cta = `<button class="verif-cta" data-level="${lvl.level}">درخواست احراز</button>`;
        }
      }

      wrap.innerHTML = `
        <div class="vdot">${toFa(lvl.level)}</div>
        <div class="verif-body">
          <h4>${title}</h4>
          <p>${meta.desc}</p>
          ${statusBadge}
          <div>${cta}</div>
        </div>`;
      root.appendChild(wrap);

      const btn = wrap.querySelector('.verif-cta');
      if (btn) btn.addEventListener('click', () => requestVerification(lvl));
    });
  }

  async function requestVerification(lvl) {
    // The button is rendered disabled when fields are missing, so this is
    // primarily a safety net (e.g. someone re-enables it via devtools).
    if (lvl.missing_fields && lvl.missing_fields.length) {
      DakhlyarModal.alert({
        title: 'اطلاعات ناقص',
        message: 'ابتدا اطلاعات لازم را در «مشخصات کاربر» تکمیل کنید سپس درخواست احراز را ارسال کنید.',
        subType: 'warning',
      });
      return;
    }

    const ok = await DakhlyarModal.confirm({
      title: 'درخواست احراز هویت',
      message: `درخواست ارتقاء به سطح ${toFa(lvl.level)} احراز هویت ثبت شود؟ پس از بررسی و تایید توسط ادمین، سطح احراز شما افزایش پیدا می‌کند.`,
      confirmText: 'ارسال درخواست',
      cancelText: 'انصراف',
    });
    if (!ok) return;

    const loadingToken = DakhlyarModal.loading({ message: 'در حال ثبت درخواست…' });
    const r = await fetchJson('/api/verification/request', {
      method: 'POST',
      body: JSON.stringify({ requested_level: lvl.level }),
    });
    DakhlyarModal.closeLoading(loadingToken);

    if (r.ok) {
      await DakhlyarModal.alert({
        title: 'درخواست ثبت شد',
        message: r.data.message || 'درخواست احراز هویت با موفقیت ثبت شد و در صف بررسی ادمین قرار گرفت.',
        subType: 'success',
      });
      await loadVerif();
      renderVerifList();
    } else {
      DakhlyarModal.alert({
        title: 'خطا در ثبت درخواست',
        message: r.data.message || 'ثبت درخواست ناموفق بود. لطفاً دوباره تلاش کنید.',
        subType: 'error',
      });
    }
  }

  // ====================== Subscription subview ======================

  async function loadSub() {
    // Phase 3-C — fetch the discount alongside status & plans so the UI can
    // show the discounted price + badge in a single pass.
    const [stat, plans, disc] = await Promise.all([
      fetchJson('/api/subscription/status'),
      fetchJson('/api/subscription/plans'),
      fetchJson('/api/referral/discount'),
    ]);
    if (stat.status === 401) { location.href = '/'; return; }
    subData = {
      status: stat.ok ? stat.data : null,
      plans: plans.ok ? (plans.data.plans || []) : [],
      planDiscount: plans.ok ? (plans.data.discount || null) : null,
      pendingInviterPct: plans.ok ? Number(plans.data.pending_inviter_discount_percent || 0) : 0,
      discount: disc.ok ? disc.data : null,
    };
  }

  function renderSubscriptionView() {
    const wrap = $('#subscriptionWrap');
    wrap.innerHTML = '';
    if (!subData) return;

    if (subData.status && subData.status.is_active) {
      const s = subData.status;
      const card = document.createElement('div');
      card.className = 'active-sub-card';
      card.innerHTML = `
        <span class="badge">اشتراک فعال</span>
        <h3>${escapeHtml(s.plan_name || '')}</h3>
        <p>تاریخ انقضا: ${escapeHtml(formatDate(s.expires_at))}</p>
        <p>روزهای باقی‌مانده: ${toFa(s.days_remaining ?? 0)} روز</p>`;
      wrap.appendChild(card);
    }

    if (subData.status && subData.status.pending_request) {
      const pr = subData.status.pending_request;
      const banner = document.createElement('div');
      banner.className = 'sub-pending-banner';
      banner.textContent = `درخواست اشتراک «${pr.plan}» در انتظار تایید است.`;
      wrap.appendChild(banner);
    }

    if (!(subData.status && subData.status.is_active)) {
      // Phase 3-C — show a top-of-section banner when a discount is locked-in.
      const inv = subData.discount;
      const pendingPct = subData.pendingInviterPct || 0;
      if ((inv && inv.has_discount) || pendingPct > 0) {
        const banner = document.createElement('div');
        banner.className = 'sub-pending-banner';
        banner.style.background = 'linear-gradient(90deg, #1B7A3E, #2E9D5C)';
        banner.style.color = '#fff';
        banner.style.fontWeight = '700';
        const parts = [];
        if (inv && inv.has_discount) {
          parts.push(`کد دعوت: ${toFa(inv.discount_percent)}٪ تخفیف${inv.expires_at ? ` — تا ${formatDate(inv.expires_at)}` : ''}`);
        }
        if (pendingPct > 0) {
          parts.push(`تخفیف انباشته از دعوت‌های شما: ${toFa(pendingPct)}٪`);
        }
        banner.textContent = parts.join(' • ');
        wrap.appendChild(banner);
      }

      const sec = document.createElement('div');
      sec.className = 'section';
      sec.innerHTML = `<div class="section-title">پلن‌های اشتراک</div>`;
      const scroller = document.createElement('div');
      scroller.className = 'plans-scroll';

      const medals = { silver: '🥈', gold: '🥇', diamond: '💎' };
      const hasPending = !!(subData.status && subData.status.pending_request);

      subData.plans.forEach((p) => {
        const card = document.createElement('div');
        card.className = `plan-card ${p.key}`;
        const discPct = Number(p.discount_percent || 0);
        const finalPrice = p.final_price != null ? p.final_price : p.price;
        const priceHtml = discPct > 0
          ? `<span class="plan-price-original">${formatToman(p.price)}</span>
             <span class="plan-price-final">${formatToman(finalPrice)}</span>
             <br><small>برای ${toFa(p.duration_months)} ماه</small>`
          : `${formatToman(p.price)}<br><small>برای ${toFa(p.duration_months)} ماه</small>`;
        const badgeHtml = discPct > 0
          ? `<div class="plan-discount-badge">${toFa(discPct)}٪ تخفیف</div>`
          : '';
        card.innerHTML = `
          <div class="plan-medal">${medals[p.key] || '★'}</div>
          <div class="plan-name">${escapeHtml(p.name)}</div>
          <div class="plan-duration">${escapeHtml(p.label)}</div>
          ${badgeHtml}
          <div class="plan-price">${priceHtml}</div>
          <button class="plan-cta" data-plan="${p.key}" ${hasPending ? 'disabled' : ''}>
            ${hasPending ? 'درخواست در حال بررسی' : 'درخواست خرید'}
          </button>`;
        scroller.appendChild(card);
        const btn = card.querySelector('.plan-cta');
        if (btn && !hasPending) {
          btn.addEventListener('click', () => requestSubscription(p));
        }
      });

      sec.appendChild(scroller);
      wrap.appendChild(sec);
    }
  }

  async function requestSubscription(plan) {
    const ok = await DakhlyarModal.confirm({
      title: `درخواست اشتراک ${plan.name}`,
      message: `درخواست خرید اشتراک «${plan.name}» به مبلغ ${formatToman(plan.price)} ثبت می‌شود. پس از تایید توسط ادمین، اشتراک شما به مدت ${toFa(plan.duration_months)} ماه فعال خواهد شد.`,
      confirmText: 'ارسال درخواست',
      cancelText: 'انصراف',
    });
    if (!ok) return;

    const loadingToken = DakhlyarModal.loading({ message: 'در حال ثبت درخواست…' });
    const r = await fetchJson('/api/subscription/request', {
      method: 'POST',
      body: JSON.stringify({ plan: plan.key }),
    });
    DakhlyarModal.closeLoading(loadingToken);

    if (r.ok) {
      await DakhlyarModal.alert({
        title: 'درخواست ثبت شد',
        message: r.data.message || 'درخواست اشتراک شما با موفقیت ثبت شد و در صف بررسی ادمین قرار گرفت.',
        subType: 'success',
      });
      if (r.data.warning) toast(r.data.warning, 4500);
      await loadSub();
      renderSubscriptionView();
    } else {
      DakhlyarModal.alert({
        title: 'خطا در ثبت درخواست',
        message: r.data.message || 'ثبت درخواست اشتراک ناموفق بود. لطفاً دوباره تلاش کنید.',
        subType: 'error',
      });
    }
  }

  // ====================== Devices subview ======================

  async function loadDevices() {
    const root = $('#devicesList');
    root.innerHTML = '<div class="muted" style="padding:14px">در حال بارگذاری…</div>';
    const r = await fetchJson('/api/profile/devices');
    if (r.status === 401) { location.href = '/'; return; }
    if (!r.ok) { root.innerHTML = `<div class="muted" style="padding:14px">${escapeHtml(r.data.message || 'خطا')}</div>`; return; }
    const devices = r.data.devices || [];
    if (!devices.length) {
      root.innerHTML = '<div class="coming-soon">دستگاهی یافت نشد.</div>';
      return;
    }
    root.innerHTML = '';
    const icons = { mobile: '📱', tablet: '📋', desktop: '💻' };
    devices.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'device-row';
      row.innerHTML = `
        <div class="device-ico">${icons[d.device_type] || '💻'}</div>
        <div class="device-info">
          <div class="device-name">${escapeHtml(d.device_name)}</div>
          <div class="device-meta">${escapeHtml(d.ip_address || '—')} • آخرین فعالیت: ${escapeHtml(formatDateTime(d.last_active))}</div>
        </div>
        <button class="device-del" data-id="${d.id}">حذف</button>`;
      root.appendChild(row);
      row.querySelector('.device-del').addEventListener('click', () => deleteDevice(d));
    });
  }

  async function deleteDevice(d) {
    const ok = await DakhlyarModal.confirm({
      title: 'حذف دستگاه',
      message: `دستگاه «${d.device_name}» از حساب شما حذف می‌شود. آیا مطمئن هستید؟`,
      confirmText: 'حذف',
      cancelText: 'انصراف',
      type: 'danger',
    });
    if (!ok) return;

    const loadingToken = DakhlyarModal.loading({ message: 'در حال حذف…' });
    const r = await fetchJson(`/api/profile/devices/${d.id}`, { method: 'DELETE' });
    DakhlyarModal.closeLoading(loadingToken);

    if (r.ok) {
      toast(r.data.message || 'دستگاه حذف شد');
      await loadDevices();
    } else {
      DakhlyarModal.alert({
        title: 'خطا در حذف دستگاه',
        message: r.data.message || 'حذف دستگاه ناموفق بود.',
        subType: 'error',
      });
    }
  }

  // ====================== Invite subview ======================

  async function loadInvite() {
    const [codeRes, invitesRes] = await Promise.all([
      fetchJson('/api/profile/invite-code'),
      fetchJson('/api/referral/my-invites'),
    ]);
    if (codeRes.ok && codeRes.data.invite_code) {
      $('#inviteCodeBox').textContent = codeRes.data.invite_code;
      const hint = $('#inviteShareHint');
      if (hint) hint.textContent = `با کد ${codeRes.data.invite_code} در دخلیار ثبت‌نام کن و تخفیف اشتراک بگیر!`;
    }
    if (invitesRes.ok) renderInviteStats(invitesRes.data);
  }

  function renderInviteStats(data) {
    if (!data) return;
    const total = Number(data.total_invites || 0);
    const earned = Number(data.discount_earned_count || 0);
    const remaining = Number(data.discount_remaining || 0);
    const pendingPct = Number(data.pending_inviter_discount_percent || 0);
    const cap = earned + remaining || 5;
    const pct = Math.min(100, Math.round((earned / cap) * 100));

    const statsSec = $('#inviteStatsSection');
    const statsBody = $('#inviteStatsBody');
    if (statsSec && statsBody) {
      statsSec.style.display = '';
      statsBody.innerHTML = `
        <div class="invite-stat-row">
          <span>تعداد دعوت‌شدگان</span>
          <strong>${toFa(total)} نفر</strong>
        </div>
        <div class="invite-stat-row">
          <span>تخفیف‌های کسب‌شده</span>
          <strong>${toFa(earned)} از ${toFa(earned + remaining)}</strong>
        </div>
        <div class="invite-progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
        ${pendingPct > 0
          ? `<div class="invite-stat-pending">💰 تخفیف انباشته‌شده برای خرید بعدی: ${toFa(pendingPct)}٪</div>`
          : ''}
      `;
    }

    const listSec = $('#inviteListSection');
    const list = $('#inviteList');
    if (!listSec || !list) return;
    const invites = Array.isArray(data.invites) ? data.invites : [];
    if (!invites.length) {
      listSec.style.display = 'none';
      return;
    }
    listSec.style.display = '';
    list.innerHTML = '';
    invites.forEach((iv) => {
      const row = document.createElement('div');
      row.className = 'invite-row';
      const purchased = iv.purchased_subscription;
      const badge = purchased
        ? `<span class="invite-row-badge">${iv.discount_earned ? '+' + toFa(iv.discount_earned) : 'خرید شد'}</span>`
        : `<span class="invite-row-badge pending">در انتظار خرید</span>`;
      row.innerHTML = `
        <div>
          <div class="invite-row-name">${escapeHtml(iv.invitee_name || 'کاربر دخلیار')}</div>
          <div class="invite-row-meta">${escapeHtml(formatDate(iv.joined_at) || '—')}</div>
        </div>
        ${badge}
      `;
      list.appendChild(row);
    });
  }

  $('#copyInviteBtn')?.addEventListener('click', async () => {
    const text = $('#inviteCodeBox').textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('کد دعوت کپی شد');
    } catch (_) { toast('کپی موفق نبود'); }
  });
  $('#shareInviteBtn')?.addEventListener('click', async () => {
    const code = $('#inviteCodeBox').textContent || '';
    const text = `با کد ${code} در دخلیار ثبت‌نام کن و تخفیف اشتراک بگیر!`;
    // Try the Web Share API first (mobile/PWA), then fall back to clipboard.
    if (navigator.share) {
      try { await navigator.share({ title: 'دعوت به دخلیار', text }); return; } catch (_) {}
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('متن دعوت کپی شد — برای دوستان خود ارسال کنید');
    } catch (_) { toast('کپی موفق نبود'); }
  });

  // ====================== FAQ ======================

  const FAQ = [
    ['چطور می‌توانم هزینه‌ای ثبت کنم؟',
     'از صفحه اصلی دکمه + را بزنید و اطلاعات تراکنش را وارد کنید.'],
    ['آیا اطلاعات من امن است؟',
     'بله، تمام اطلاعات شما رمزنگاری شده و روی سرورهای امن ذخیره می‌شود.'],
    ['چطور سطح احراز هویتم را ارتقا دهم؟',
     'از بخش پروفایل، گزینه سطح احراز هویت را انتخاب کرده و اطلاعات مورد نیاز را تکمیل کنید.'],
    ['اشتراک چه امکاناتی به من می‌دهد؟',
     'با خرید اشتراک به امکانات پیشرفته از جمله گزارش‌های تخصصی، بودجه‌بندی هوشمند و پشتیبانی اولویت‌دار دسترسی خواهید داشت.'],
    ['آیا می‌توانم اشتراک را لغو کنم؟',
     'در حال حاضر لغو اشتراک از طریق پشتیبانی آنلاین امکان‌پذیر است.'],
    ['اگر رمز عبورم را فراموش کردم چه کار کنم؟',
     'از صفحه ورود، گزینه فراموشی رمز عبور را انتخاب کنید. یک کد تایید به ایمیل شما ارسال می‌شود.'],
    ['چطور دستگاه‌های متصل را مدیریت کنم؟',
     'از پروفایل > مدیریت حساب > دستگاه‌های متصل می‌توانید دستگاه‌های ناشناس را حذف کنید.'],
    ['آیا دخلیار برای کسب‌وکار هم مناسب است؟',
     'دخلیار در حال حاضر برای مدیریت مالی شخصی طراحی شده است. نسخه کسب‌وکار به زودی اضافه می‌شود.'],
  ];

  function renderFaq() {
    const root = $('#faqList');
    if (root.dataset.rendered === '1') return;
    root.dataset.rendered = '1';
    FAQ.forEach(([q, a]) => {
      const item = document.createElement('div');
      item.className = 'faq-item';
      item.innerHTML = `<button class="faq-q">${escapeHtml(q)}</button><div class="faq-a">${escapeHtml(a)}</div>`;
      root.appendChild(item);
      item.querySelector('.faq-q').addEventListener('click', () => item.classList.toggle('open'));
    });
  }

  // ====================== Change-password modal ======================

  const modal = $('#changePwModal');
  function openModal() {
    $('#cp_current').value = '';
    $('#cp_new').value = '';
    $('#cp_confirm').value = '';
    $('#cp_err').style.display = 'none';
    modal.classList.add('open');
  }
  function closeModal() { modal.classList.remove('open'); }

  $('#openChangePw')?.addEventListener('click', openModal);
  $('#cp_cancel')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  $('#changePwForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#cp_err');
    err.style.display = 'none';
    const current = $('#cp_current').value;
    const np      = $('#cp_new').value;
    const cp      = $('#cp_confirm').value;
    if (!current || !np || !cp) { err.textContent = 'تمام فیلدها الزامی هستند'; err.style.display = 'block'; return; }
    if (np !== cp) { err.textContent = 'رمز عبور و تکرار آن یکسان نیستند'; err.style.display = 'block'; return; }
    if (!PASSWORD_REGEX.test(np)) {
      err.textContent = 'رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد';
      err.style.display = 'block'; return;
    }
    if (np === current) { err.textContent = 'رمز عبور جدید نمیتواند با رمز فعلی یکسان باشد'; err.style.display = 'block'; return; }

    const r = await fetchJson('/api/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: current, new_password: np, confirm_password: cp }),
    });
    if (r.ok) {
      closeModal();
      toast(r.data.message || 'رمز عبور تغییر کرد');
    } else {
      err.textContent = r.data.message || 'خطا در تغییر رمز عبور';
      err.style.display = 'block';
    }
  });

  // ====================== Logout ======================

  $('#logoutBtn')?.addEventListener('click', async () => {
    const ok = await DakhlyarModal.confirm({
      title: 'خروج از حساب',
      message: 'آیا می‌خواهید از حساب کاربری خود خارج شوید؟',
      confirmText: 'خروج',
      cancelText: 'انصراف',
      type: 'danger',
    });
    if (!ok) return;
    const loadingToken = DakhlyarModal.loading({ message: 'در حال خروج…' });
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' });
    } finally {
      DakhlyarModal.closeLoading(loadingToken);
      location.href = '/';
    }
  });

  // ====================== bootstrap ======================

  (async () => {
    try {
      await ensureMe();
      await activateView(currentView());
    } catch (_) {
      // redirected to / on auth failure
    }
  })();
})();
