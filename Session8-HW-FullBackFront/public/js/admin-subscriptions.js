/**
 * admin-subscriptions.js (dev panel)
 * Lists subscription requests and lets the dev admin approve/reject them.
 */
(function () {
  'use strict';

  const $  = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const toFa = (s) => String(s ?? '').replace(/[0-9]/g, (d) => FA[+d]);

  const MEDALS = { silver: '🥈', gold: '🥇', diamond: '💎' };

  let toastTimer = null;
  function toast(message, ms = 2300) {
    const el = $('#toast'); if (!el) return;
    el.textContent = message; el.style.display = 'block';
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

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatToman(n) {
    if (n == null) return '—';
    const formatted = Number(n).toLocaleString('en-US').replace(/,/g, '٬');
    return `${toFa(formatted)} تومان`;
  }

  // Shared Jalali helpers (loaded from /js/date-fa.js).
  const formatDateTime = (iso) => window.formatJalaliDateTime(iso);
  const formatDate     = (iso) => window.formatJalaliDate(iso);

  // ---- state ----
  let allRequests = [];
  let currentFilter = 'all';

  // ---- admin status (same pattern as verifications page) ----
  async function refreshAdminStatus() {
    const r = await fetchJson('/api/admin/stories/admin-status');
    const box = $('#adminStatusBox');
    if (!r.ok) { box.textContent = 'خطا در دریافت وضعیت ادمین'; return; }
    if (r.data.isAdmin) {
      box.innerHTML = '<span class="status-pill on">✓ به‌عنوان ادمین وارد شده‌اید</span>';
    } else {
      box.innerHTML = '<span class="status-pill off">⚠ وارد نشده — برای مدیریت درخواست‌ها ابتدا Dev Login بزنید</span>';
    }
  }
  $('#refreshStatusBtn').addEventListener('click', refreshAdminStatus);
  $('#devLoginBtn').addEventListener('click', async () => {
    const r = await fetchJson('/api/admin/stories/dev-login', { method: 'POST' });
    toast(r.ok ? (r.data.message || 'ورود موفق') : (r.data.message || 'خطا'));
    refreshAdminStatus(); loadList();
  });
  $('#devLogoutBtn').addEventListener('click', async () => {
    const r = await fetchJson('/api/admin/stories/dev-logout', { method: 'POST' });
    toast(r.ok ? (r.data.message || 'خروج موفق') : (r.data.message || 'خطا'));
    refreshAdminStatus(); loadList();
  });

  // ---- list + filter ----
  $('#refreshListBtn').addEventListener('click', loadList);
  $$('.filter-bar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.filter-bar button').forEach((b) => b.classList.toggle('active', b === btn));
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  async function loadList() {
    $('#reqList').innerHTML = '<div class="empty-state">در حال بارگذاری…</div>';
    const r = await fetchJson('/api/admin/subscriptions');
    if (r.status === 401) {
      $('#reqList').innerHTML = '<div class="empty-state">برای مشاهده‌ی درخواست‌ها ابتدا با Dev Login وارد شوید.</div>';
      return;
    }
    if (!r.ok) {
      $('#reqList').innerHTML = `<div class="empty-state">${escapeHtml(r.data.message || 'خطا در دریافت لیست')}</div>`;
      return;
    }
    allRequests = r.data.requests || [];
    render();
  }

  function statusLabel(s) {
    return { pending: 'در انتظار', approved: 'تایید‌شده', rejected: 'رد‌شده' }[s] || s;
  }

  function render() {
    const root = $('#reqList');
    const filtered = currentFilter === 'all'
      ? allRequests
      : allRequests.filter((req) => req.status === currentFilter);
    if (!filtered.length) {
      root.innerHTML = '<div class="empty-state">هیچ درخواستی در این بخش نیست.</div>';
      return;
    }
    root.innerHTML = '';
    filtered.forEach((req) => {
      const card = document.createElement('div');
      card.className = `req-card ${req.status === 'pending' ? 'pending' : ''}`;
      const name = ((req.first_name || '') + ' ' + (req.last_name || '')).trim() || 'کاربر دخلیار';
      const currentSubInfo = req.subscription_plan
        ? `${req.subscription_plan} (انقضا: ${escapeHtml(formatDate(req.subscription_expires_at))})`
        : 'ندارد';

      card.innerHTML = `
        <div class="req-user">${escapeHtml(name)} <small>#${toFa(req.user_id)} • ${toFa(req.mobile || '')} • ${escapeHtml(req.email || '')}</small></div>
        <div class="req-row">
          <div><b>پلن درخواستی:</b> ${MEDALS[req.plan] || '★'} ${escapeHtml(req.plan_name || req.plan)} (${toFa(req.duration_months)} ماه)</div>
          <div><b>قیمت:</b> ${formatToman(req.price)}</div>
          <div><b>وضعیت:</b> <span class="status-pill ${req.status}">${statusLabel(req.status)}</span></div>
        </div>
        <div class="req-detail">
          <div><span>اشتراک فعلی کاربر:</span> <b>${escapeHtml(currentSubInfo)}</b></div>
        </div>
        ${req.admin_note ? `<div class="req-meta" style="text-align:right;direction:rtl">یادداشت ادمین: ${escapeHtml(req.admin_note)}</div>` : ''}
        <div class="req-meta">ایجاد: ${formatDateTime(req.created_at)}${req.reviewed_at ? ' • بازبینی: ' + formatDateTime(req.reviewed_at) : ''}</div>
        ${req.status === 'pending' ? `
          <div class="req-actions">
            <input type="text" placeholder="یادداشت اختیاری (مثلاً شماره فاکتور یا دلیل رد)" data-id="${req.id}" />
            <button class="btn-approve" data-action="approve" data-id="${req.id}">تایید و فعال‌سازی</button>
            <button class="btn-reject"  data-action="reject"  data-id="${req.id}">رد</button>
          </div>` : ''}`;
      root.appendChild(card);
    });

    root.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn));
    });
  }

  async function handleAction(btn) {
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const noteInput = btn.parentElement.querySelector(`input[data-id="${id}"]`);
    const note = noteInput ? noteInput.value.trim() : '';

    const ok = action === 'approve'
      ? await DakhlyarModal.confirm({
          title: 'تایید و فعال‌سازی اشتراک',
          message: 'این درخواست تایید و اشتراک کاربر فعال شود؟ تاریخ انقضا بر اساس مدت پلن تنظیم می‌گردد.',
          confirmText: 'تایید و فعال‌سازی',
          cancelText: 'انصراف',
        })
      : await DakhlyarModal.confirm({
          title: 'رد درخواست اشتراک',
          message: 'این درخواست اشتراک رد شود؟ وضعیت اشتراک فعلی کاربر تغییری نخواهد کرد.',
          confirmText: 'رد درخواست',
          cancelText: 'انصراف',
          type: 'danger',
        });
    if (!ok) return;

    btn.disabled = true;
    const loadingToken = DakhlyarModal.loading({
      message: action === 'approve' ? 'در حال فعال‌سازی اشتراک…' : 'در حال رد درخواست…',
    });
    const r = await fetchJson(`/api/admin/subscriptions/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ note: note || undefined }),
    });
    DakhlyarModal.closeLoading(loadingToken);
    btn.disabled = false;

    if (r.ok) {
      await DakhlyarModal.alert({
        message: r.data.message || 'انجام شد',
        subType: 'success',
      });
      loadList();
    } else {
      DakhlyarModal.alert({
        title: 'خطا',
        message: r.data.message || 'خطا در انجام عملیات',
        subType: 'error',
      });
    }
  }

  refreshAdminStatus();
  loadList();
})();
