(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => (window.toPersianDigits ? window.toPersianDigits(n) : String(n));

  const STATUS_LABELS = {
    pending: 'در انتظار انجام',
    done: 'انجام شد ✓',
    dismissed: 'رد شد',
  };

  const PRIORITY_LABELS = {
    urgent: 'فوری 🚨',
    high: 'مهم',
    medium: 'متوسط',
    low: 'کم',
  };

  let recommendations = [];
  let counts = { total: 0, pending: 0, done: 0, dismissed: 0 };
  let onlyActive = true;
  let typeFilter = 'all';
  let selectedRec = null;

  async function api(path, opts = {}) {
    const fetchOpts = {
      credentials: 'same-origin',
      method: opts.method || 'GET',
      headers: {},
    };
    if (opts.body != null) {
      fetchOpts.headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, fetchOpts);
    if (res.status === 401) {
      window.location.href = '/';
      throw new Error('unauthorized');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
    return body;
  }

  function fmtDate(dt) {
    if (window.formatJalaliDateTime) return formatJalaliDateTime(dt);
    return pd(String(dt || '').slice(0, 16));
  }

  function fmtTargetPercent(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '';
    const parts = num.toFixed(2).split('.');
    const fa = pd(parts[0]) + '.' + pd(parts[1]);
    return `← ${fa}٪ به پرتفوی هدف نزدیک شو`;
  }

  function renderShell() {
    $('main-content').innerHTML = `
      <div id="expert-loading" class="expert-loading">در حال بارگذاری…</div>
      <div id="expert-app" style="display:none;">
        <div class="expert-stats-bar">
          <div class="expert-stat-pill pending">🔵 در انتظار: <span id="stat-pending">۰</span></div>
          <div class="expert-stat-pill done">✅ انجام‌شده: <span id="stat-done">۰</span></div>
          <div class="expert-stat-pill dismissed">➖ رد شده: <span id="stat-dismissed">۰</span></div>
        </div>

        <div class="expert-filter-bar" id="filter-bar">
          <label class="expert-only-active">
            <input type="checkbox" id="only-active" checked />
            فقط پیشنهاد فعال
          </label>
          <div class="expert-filter-pills">
            <button type="button" class="expert-filter-pill active" data-type="all">همه</button>
            <button type="button" class="expert-filter-pill" data-type="action">اقدام</button>
            <button type="button" class="expert-filter-pill" data-type="alert">هشدار</button>
          </div>
        </div>

        <div class="expert-list-wrap">
          <div id="rec-list"></div>
          <div id="rec-empty" class="expert-empty" style="display:none;">
            <div class="icon">💡</div>
            <h3 id="empty-title">هنوز پیشنهادی ثبت نشده است</h3>
            <p id="empty-desc">پیشنهادات تخصصی توسط تیم دخلیار اینجا نمایش داده می‌شوند.</p>
          </div>
        </div>
      </div>
    `;

    $('only-active').addEventListener('change', (e) => {
      onlyActive = e.target.checked;
      loadRecommendations();
    });

    document.querySelectorAll('.expert-filter-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        typeFilter = pill.dataset.type;
        document.querySelectorAll('.expert-filter-pill').forEach((p) => {
          p.classList.toggle('active', p.dataset.type === typeFilter);
        });
        loadRecommendations();
      });
    });

    $('btn-filter-toggle').addEventListener('click', () => {
      const bar = $('filter-bar');
      bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
    });

    $('sheet-overlay').addEventListener('click', () => closeSheet('detail-sheet'));
    document.querySelectorAll('[data-close-sheet]').forEach((btn) => {
      btn.addEventListener('click', () => closeSheet(btn.dataset.closeSheet));
    });
  }

  function openSheet(id) {
    $('sheet-overlay').classList.add('show');
    const s = $(id);
    if (s) requestAnimationFrame(() => s.classList.add('show'));
  }

  function closeSheet(id) {
    const s = $(id);
    if (s) s.classList.remove('show');
    $('sheet-overlay').classList.remove('show');
    selectedRec = null;
  }

  function renderStats() {
    $('stat-pending').textContent = pd(counts.pending);
    $('stat-done').textContent = pd(counts.done);
    $('stat-dismissed').textContent = pd(counts.dismissed);
  }

  function renderList() {
    const list = $('rec-list');
    const empty = $('rec-empty');

    if (!recommendations.length) {
      list.innerHTML = '';
      empty.style.display = 'block';
      if (counts.total > 0 && counts.pending === 0) {
        $('empty-title').textContent = '🎉 همه پیشنهادات انجام شده‌اند';
        $('empty-desc').textContent = 'عالی! تمام پیشنهادات فعال را بررسی کرده‌اید.';
      } else {
        $('empty-title').textContent = 'هنوز پیشنهادی ثبت نشده است';
        $('empty-desc').textContent = 'پیشنهادات تخصصی توسط تیم دخلیار اینجا نمایش داده می‌شوند.';
      }
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = recommendations.map((rec) => {
      const pri = rec.priority || 'medium';
      const st = rec.user_status || 'pending';
      const cardCls = [
        'rec-card',
        `priority-${pri}`,
        st,
        rec.is_expired ? 'expired' : '',
      ].filter(Boolean).join(' ');

      let priorityHtml = '';
      if (pri === 'urgent' || pri === 'high') {
        priorityHtml = `<span class="priority-badge ${pri}">${PRIORITY_LABELS[pri]}</span>`;
      }

      let statusHtml = `<span class="rec-status-badge ${st}">${STATUS_LABELS[st]}</span>`;
      if (rec.is_expired) {
        statusHtml += `<span class="rec-status-badge expired">منقضی شده</span>`;
      }

      const targetHtml = rec.type === 'action' && rec.target_percent != null
        ? `<div class="rec-card-target">${fmtTargetPercent(rec.target_percent)}</div>`
        : '';

      const icon = rec.type === 'alert' ? '🔔' : (st === 'done' ? '✅' : '✓');

      return `
        <article class="${cardCls}" data-id="${rec.id}">
          <div class="rec-card-header">
            <span class="rec-card-type-icon">${icon}</span>
            <div class="rec-card-title">${rec.title}</div>
            <div class="rec-card-badges">${priorityHtml}</div>
          </div>
          ${targetHtml}
          <div class="rec-card-footer">
            <span class="rec-card-date">${fmtDate(rec.created_at)}</span>
            ${statusHtml}
          </div>
        </article>`;
    }).join('');

    list.querySelectorAll('.rec-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.id);
        const rec = recommendations.find((r) => r.id === id);
        if (rec) openDetail(rec);
      });
    });
  }

  function openDetail(rec) {
    selectedRec = rec;
    $('detail-title').textContent = rec.title;

    let meta = `
      <div class="rec-detail-meta">
        <div class="rec-detail-row"><span class="lbl">نوع</span><span class="val">${rec.type === 'action' ? 'اقدام' : 'هشدار'}</span></div>
        <div class="rec-detail-row"><span class="lbl">اولویت</span><span class="val">${PRIORITY_LABELS[rec.priority] || rec.priority}</span></div>
        <div class="rec-detail-row"><span class="lbl">وضعیت</span><span class="val">${STATUS_LABELS[rec.user_status] || rec.user_status}</span></div>`;
    if (rec.asset_name) {
      meta += `<div class="rec-detail-row"><span class="lbl">دارایی</span><span class="val">${rec.asset_name}</span></div>`;
    }
    if (rec.target_percent != null && rec.type === 'action') {
      meta += `<div class="rec-detail-row"><span class="lbl">هدف</span><span class="val">${fmtTargetPercent(rec.target_percent).replace('← ', '')}</span></div>`;
    }
    if (rec.expires_at) {
      meta += `<div class="rec-detail-row"><span class="lbl">انقضا</span><span class="val">${fmtDate(rec.expires_at)}</span></div>`;
    }
    meta += `<div class="rec-detail-row"><span class="lbl">تاریخ</span><span class="val">${fmtDate(rec.created_at)}</span></div></div>`;

    $('detail-body').innerHTML = meta + `<div class="rec-detail-body">${rec.body}</div>`;

    const foot = $('detail-foot');
    if (rec.type === 'action') {
      foot.style.display = 'block';
      const st = rec.user_status || 'pending';
      foot.innerHTML = `
        <div class="rec-status-actions">
          <button type="button" class="rec-status-btn${st === 'done' ? ' active-done' : ''}" data-status="done">✓ انجام شد</button>
          <button type="button" class="rec-status-btn${st === 'pending' ? ' active-pending' : ''}" data-status="pending">⏳ در انتظار</button>
          <button type="button" class="rec-status-btn${st === 'dismissed' ? ' active-dismissed' : ''}" data-status="dismissed">✕ رد کردن</button>
        </div>`;
      foot.querySelectorAll('.rec-status-btn').forEach((btn) => {
        btn.addEventListener('click', () => updateStatus(rec.id, btn.dataset.status));
      });
    } else {
      foot.style.display = 'none';
      foot.innerHTML = '';
    }

    openSheet('detail-sheet');
  }

  async function updateStatus(id, status) {
    try {
      await api(`/api/expert/recommendations/${id}/status`, {
        method: 'PATCH',
        body: { status },
      });
      closeSheet('detail-sheet');
      await loadRecommendations();
    } catch (err) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: err.message, subType: 'error' });
    }
  }

  async function loadRecommendations() {
    try {
      const q = new URLSearchParams({
        status: 'all',
        only_active: onlyActive ? 'true' : 'false',
      });
      if (typeFilter !== 'all') q.set('type', typeFilter);
      const data = await api('/api/expert/recommendations?' + q.toString());
      recommendations = data.recommendations || [];
      counts = data.counts || counts;
      renderStats();
      renderList();
    } catch (err) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: err.message, subType: 'error' });
    }
  }

  async function initApp() {
    renderShell();
    $('expert-loading').style.display = 'block';
    $('expert-app').style.display = 'none';
    await loadRecommendations();
    $('expert-loading').style.display = 'none';
    $('expert-app').style.display = 'block';
    if (window.updateMessageBadge) updateMessageBadge();
    DakhlyarNav.init('expert');
  }

  function init() {
    checkSubscriptionGate(
      initApp,
      () => showLockedScreen($('main-content'), 'پیشنهاد تخصصی')
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
