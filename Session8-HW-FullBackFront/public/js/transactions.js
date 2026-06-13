(function () {
  'use strict';

  /* ── Debug logging (always on — check DevTools → Console) ─────────── */
  const TX_VERSION = '20260612c';
  const txLog = (area, msg, data) => {
    if (data !== undefined) console.log(`[transactions:${area}] ${msg}`, data);
    else console.log(`[transactions:${area}] ${msg}`);
  };
  const txErr = (area, msg, err) => {
    console.error(`[transactions:${area}] ${msg}`, err);
  };

  window.__dakhlyarTxDebug = {
    version: TX_VERSION,
    getState: () => state,
    log: txLog,
  };

  window.addEventListener('error', (ev) => {
    txErr('global', ev.message || 'uncaught error', ev.error);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    txErr('global', 'unhandled promise rejection', ev.reason);
  });

  /* ─────────────────────── STEP 1 — HELPERS ─────────────────────── */
  const $ = (id) => document.getElementById(id);

  function requireEl(id, label) {
    const el = $(id);
    if (!el) txErr('init', `Missing #${id}${label ? ` (${label})` : ''}`);
    return el;
  }

  function on(el, event, handler, label) {
    if (!el) {
      txErr('init', `Cannot attach ${event} — element missing${label ? `: ${label}` : ''}`);
      return;
    }
    el.addEventListener(event, handler);
    txLog('init', `wired ${event} → ${label || el.id || 'element'}`);
  }

  function pd(n) {
    return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }

  function formatAmount(n) {
    return pd(Number(n).toLocaleString('en'));
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function arabicToEn(s) {
    return String(s || '')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  }

  // CRITICAL: normalize every transaction from API
  function normalizeTransaction(it) {
    return {
      ...it,
      id: Number(it.id),
      amount: Number(it.amount),
      is_recurring: it.is_recurring === 1 || it.is_recurring === true,
      tags: it.tags
        ? String(it.tags).split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    };
  }

  function todayGreg() {
    return new Date().toISOString().slice(0, 10);
  }

  function todayJalali() {
    const j = window.Jalali.todayJalali();
    return `${j.jy}-${String(j.jm).padStart(2, '0')}-${String(j.jd).padStart(2, '0')}`;
  }

  function showToast(msg, type = 'success') {
    const old = document.getElementById('dk-toast');
    if (old) old.remove();
    const colors = {
      success: ['#ECFDF5', '#1A5C3A', '#1A5C3A'],
      error:   ['#FEF2F2', '#DC2626', '#DC2626'],
      warning: ['#FFFBEB', '#F59E0B', '#B45309'],
    };
    const [bg, border, color] = colors[type] || colors.success;
    const el = document.createElement('div');
    el.id = 'dk-toast';
    el.style.cssText = `position:fixed;top:72px;left:50%;transform:translateX(-50%);
      z-index:9999;background:${bg};border:1px solid ${border};border-radius:12px;
      padding:10px 20px;font-size:14px;font-weight:600;color:${color};
      font-family:'Vazirmatn',sans-serif;white-space:nowrap;direction:rtl;
      box-shadow:0 4px 16px rgba(0,0,0,.1);`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  /* ─────────────────────── STEP 2 — STATE ───────────────────────── */
  const state = {
    page: 1,
    limit: 30,
    totalPages: 1,
    loading: false,
    items: [],
    categories: [],
    tags: [],
    filters: { type: '', category_id: '', range: 'this-month', search: '' },
    editingId: null,
    currentDetail: null,
    form: {
      type: 'expense',
      amount: 0,
      category_id: null,
      title: '',
      note: '',
      tags: [],
      transaction_date: null,
      transaction_time: null,
      is_recurring: false,
      recurring_interval: 'monthly',
    },
  };

  /* ─────────────────────── STEP 3 — API ─────────────────────────── */
  async function api(path, opts = {}) {
    const isForm = opts.body instanceof FormData;
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: (!isForm && opts.body) ? { 'Content-Type': 'application/json' } : {},
      ...opts,
    });
    if (res.status === 401) {
      window.location.href = '/';
      throw new Error('unauthorized');
    }
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
      throw Object.assign(
        new Error((body && body.message) || `HTTP ${res.status}`),
        { body }
      );
    }
    return body;
  }

  /* ─────────────────────── STEP 4 — SHEET SYSTEM ────────────────── */
  const overlay = requireEl('sheet-overlay', 'sheet overlay');

  function openSheet(id) {
    txLog('sheet', `openSheet("${id}")`);
    closeAllSheets();
    if (overlay) overlay.classList.add('show');
    const s = document.getElementById(id);
    if (s) {
      requestAnimationFrame(() => {
        s.classList.add('show');
        txLog('sheet', `sheet visible: #${id}`);
      });
    } else {
      txErr('sheet', `openSheet — element not found: #${id}`);
    }
  }

  function closeSheet(id) {
    txLog('sheet', `closeSheet("${id}")`);
    const s = document.getElementById(id);
    if (s) s.classList.remove('show');
    const anyOpen = document.querySelectorAll('.dk-sheet.show').length > 0;
    if (!anyOpen && overlay) overlay.classList.remove('show');
  }

  function closeAllSheets() {
    document.querySelectorAll('.dk-sheet.show').forEach((s) => s.classList.remove('show'));
    if (overlay) overlay.classList.remove('show');
  }

  if (overlay) on(overlay, 'click', closeAllSheets, 'overlay → closeAllSheets');

  document.querySelectorAll('[data-close-sheet]').forEach((btn) => {
    btn.addEventListener('click', () => closeSheet(btn.dataset.closeSheet));
  });

  /* ─────────────────────── STEP 5 — LOAD TRANSACTIONS ───────────── */
  function buildQuery() {
    const p = new URLSearchParams();
    p.set('page', state.page);
    p.set('limit', state.limit);
    if (state.filters.type) p.set('type', state.filters.type);
    if (state.filters.category_id) p.set('category_id', String(state.filters.category_id));
    if (state.filters.search) p.set('search', state.filters.search);
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    if (state.filters.range === 'this-month') {
      p.set('month', `${yyyy}-${mm}`);
    } else if (state.filters.range === 'last-month') {
      const d = new Date(Date.UTC(yyyy, now.getUTCMonth() - 1, 1));
      p.set('month', `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    } else if (state.filters.range === '3-months') {
      const from = new Date(Date.UTC(yyyy, now.getUTCMonth() - 2, 1));
      p.set('date_from', from.toISOString().slice(0, 10));
      p.set('date_to', now.toISOString().slice(0, 10));
    }
    // range === 'all' → no date filter
    return '/api/transactions?' + p.toString();
  }

  async function loadAndReset() {
    state.page = 1;
    state.items = [];
    $('tx-list').innerHTML = `<div style="padding:32px;text-align:center;
      color:var(--color-text-3);font-size:13px;">در حال بارگذاری…</div>`;
    $('tx-empty').style.display = 'none';
    await loadAndAppend(true);
  }

  async function loadAndAppend(updateSummary = false) {
    if (state.loading) return;
    state.loading = true;
    try {
      const data = await api(buildQuery());
      state.totalPages = data.pagination.total_pages;
      const normalized = (data.transactions || []).map(normalizeTransaction);
      state.items = state.items.concat(normalized);
      renderList();
      if (updateSummary) renderSummary(data.summary);
    } catch (err) {
      $('tx-list').innerHTML = '';
      window.DakhlyarModal.alert({ subType: 'error', title: 'خطا', message: err.message });
    } finally {
      state.loading = false;
    }
  }

  function renderSummary(s) {
    $('sum-income').textContent  = formatAmount(s.total_income  || 0);
    $('sum-expense').textContent = formatAmount(s.total_expense || 0);
    const bal = Number(s.balance || 0);
    $('sum-balance').textContent = (bal < 0 ? '−' : '') + formatAmount(Math.abs(bal));

    const J = window.Jalali;
    let label = '';
    if (state.filters.range === 'this-month') {
      const j = J.todayJalali();
      label = `${J.persianMonthName(j.jm)} ${pd(j.jy)}`;
    } else if (state.filters.range === 'last-month') {
      const now = new Date();
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const j = J.toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      label = `${J.persianMonthName(j.jm)} ${pd(j.jy)}`;
    } else if (state.filters.range === '3-months') {
      label = '۳ ماه اخیر';
    } else {
      label = 'همه';
    }
    $('sum-month').textContent = label;
  }

  /* ─────────────────────── STEP 6 — RENDER LIST ─────────────────── */
  function groupByDate(items) {
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.transaction_date)) map.set(it.transaction_date, []);
      map.get(it.transaction_date).push(it);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }

  function renderItem(it) {
    const isIncome = it.type === 'income';
    const cat = it.category || {};
    const color = cat.color || '#9CA3AF';
    const icon  = cat.icon  || '📦';
    const tagHtml = it.tags.slice(0, 2)
      .map((t) => `<span class="tx-tag-pill">${escapeHtml(t)}</span>`).join('');
    const badges = (it.is_recurring ? '<span class="tx-mini-badge">🔄</span>' : '')
                 + (it.note         ? '<span class="tx-mini-badge">📝</span>' : '');
    return `<div class="tx-item" role="button" tabindex="0" data-id="${it.id}">
      <div class="tx-cat-icon" style="background:${color}22;color:${color}">${icon}</div>
      <div class="tx-body">
        <div class="tx-title-row"><span>${escapeHtml(it.title)}</span>${badges}</div>
        <div class="tx-meta-row"><span>${escapeHtml(cat.name || 'بدون دسته')}</span>${tagHtml}</div>
      </div>
      <div class="tx-amount ${isIncome ? 'income' : 'expense'}">
        ${isIncome ? '+' : '−'}${formatAmount(it.amount)}<span class="tx-amount-unit">ت</span>
      </div>
      <div class="tx-actions">
        <button type="button" class="tx-action-btn edit" data-action="edit"
                aria-label="ویرایش تراکنش" title="ویرایش">
          <i class="ti ti-pencil" aria-hidden="true"></i>
        </button>
        <button type="button" class="tx-action-btn del" data-action="delete"
                aria-label="حذف تراکنش" title="حذف">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
  }

  function renderList() {
    const list = $('tx-list');
    const empty = $('tx-empty');
    const loadMore = $('tx-loadmore');

    if (!state.items.length) {
      list.innerHTML = '';
      empty.style.display = 'block';
      loadMore.innerHTML = '';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = groupByDate(state.items).map(([date, rows]) => {
      const pretty = window.Jalali.formatJalaliFromGregorian(date) || date;
      return `<div class="tx-day-group">
        <div class="tx-day-header">${escapeHtml(pretty)}</div>
        ${rows.map(renderItem).join('')}
      </div>`;
    }).join('');

    if (state.page < state.totalPages) {
      loadMore.innerHTML = '<button class="btn-secondary" id="btn-loadmore">بارگذاری بیشتر</button>';
      $('btn-loadmore').addEventListener('click', () => {
        state.page++;
        loadAndAppend();
      });
    } else {
      loadMore.innerHTML = '';
    }
  }

  // Event delegation — works after every renderList() call.
  const txListEl = requireEl('tx-list', 'transaction list');
  if (txListEl) {
    on(txListEl, 'click', (e) => {
      const actionBtn = e.target.closest('.tx-action-btn');
      const item = e.target.closest('.tx-item');
      if (!item) return;
      const id = Number(item.dataset.id);
      if (!(id > 0)) return;

      if (actionBtn) {
        e.stopPropagation();
        e.preventDefault();
        const action = actionBtn.dataset.action;
        txLog('list', `action click: ${action} id=${id}`);
        if (action === 'edit')   return editById(id);
        if (action === 'delete') return confirmDelete(id);
        return;
      }
      txLog('list', `row click → detail id=${id}`);
      openDetail(id);
    }, 'tx-list click');

    on(txListEl, 'keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const actionBtn = e.target.closest('.tx-action-btn');
      const item = e.target.closest('.tx-item');
      if (!item) return;
      const id = Number(item.dataset.id);
      if (!(id > 0)) return;
      e.preventDefault();

      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === 'edit')   return editById(id);
        if (action === 'delete') return confirmDelete(id);
        return;
      }
      openDetail(id);
    }, 'tx-list keydown');
  }

  function editById(id) {
    txLog('edit', `editById(${id})`);
    const it = state.items.find((x) => x.id === id);
    if (!it) { showToast('تراکنش یافت نشد', 'error'); txErr('edit', `item ${id} not in state.items`); return; }
    openEditExisting(it);
  }

  /* ─────────────────────── STEP 7 — DETAIL SHEET ────────────────── */
  function openDetail(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) { showToast('تراکنش یافت نشد', 'error'); return; }
    state.currentDetail = it;

    const J = window.Jalali;
    const cat = it.category || {};
    const rows = [
      ['نوع',       it.type === 'income' ? '✅ درآمد' : '🔴 هزینه'],
      ['مبلغ',      `${formatAmount(it.amount)} تومان`],
      ['دسته‌بندی', `${cat.icon || ''} ${escapeHtml(cat.name || '—')}`],
      ['عنوان',     escapeHtml(it.title)],
      ['تاریخ',     J.formatJalaliFromGregorian(it.transaction_date) || it.transaction_date],
    ];
    if (it.transaction_time) rows.push(['ساعت', pd(it.transaction_time)]);
    if (it.note) rows.push(['یادداشت', escapeHtml(it.note)]);
    if (it.tags.length) rows.push(['تگ‌ها', it.tags.map((t) => `#${escapeHtml(t)}`).join(' ')]);
    if (it.is_recurring) {
      const label = { weekly: 'هفتگی', monthly: 'ماهانه', yearly: 'سالانه' }[it.recurring_interval] || 'ماهانه';
      rows.push(['تکراری 🔄', label]);
    }

    $('detail-body').innerHTML = rows.map(([k, v]) =>
      `<div class="dk-detail-row">
        <span class="lbl">${k}</span>
        <span class="val">${v}</span>
      </div>`
    ).join('');

    openSheet('detail-sheet');
  }

  $('btn-edit-tx').addEventListener('click', () => {
    if (!state.currentDetail) return;
    closeSheet('detail-sheet');
    openEditExisting(state.currentDetail);
  });

  async function confirmDelete(id) {
    const ok = await window.DakhlyarModal.confirm({
      title: 'حذف تراکنش',
      message: 'این تراکنش حذف می‌شود. ادامه می‌دهید؟',
      confirmText: 'بله، حذف کن',
      cancelText: 'انصراف',
      type: 'danger',
    });
    if (!ok) return;
    const token = window.DakhlyarModal.loading({ message: 'در حال حذف...' });
    try {
      await api(`/api/transactions/${id}`, { method: 'DELETE' });
      window.DakhlyarModal.closeLoading(token);
      closeSheet('detail-sheet');
      state.currentDetail = null;
      showToast('تراکنش با موفقیت حذف شد', 'success');
      await loadAndReset();
    } catch (err) {
      window.DakhlyarModal.closeLoading(token);
      window.DakhlyarModal.alert({ subType: 'error', message: err.message });
    }
  }

  $('btn-delete-tx').addEventListener('click', () => {
    if (!state.currentDetail) return;
    confirmDelete(state.currentDetail.id);
  });

  /* ─────────────────────── STEP 8 — CATEGORIES ──────────────────── */
  async function loadCategories() {
    try {
      const data = await api('/api/categories');
      state.categories = data.categories || [];
      renderFilterCategoryPills();
    } catch (err) {
      console.warn('categories load failed:', err);
    }
  }

  function renderCategoryGrid() {
    const wrap = $('fld-categories');
    if (!wrap) return;
    const filtered = state.categories.filter((c) =>
      c.type === 'both' || c.type === state.form.type
    );
    wrap.innerHTML = filtered.map((c) => `
      <div class="dk-cat-tile ${Number(state.form.category_id) === Number(c.id) ? 'active' : ''}"
           data-cat-id="${c.id}" role="button" tabindex="0">
        <div class="icon" style="background:${c.color}22;color:${c.color}">${c.icon || '📦'}</div>
        <div class="name">${escapeHtml(c.name)}</div>
      </div>`).join('') +
      `<div class="dk-cat-tile add-new" id="cat-request" role="button" tabindex="0">
        <div class="icon">+</div>
        <div class="name">درخواست دسته جدید</div>
      </div>`;

    wrap.querySelectorAll('.dk-cat-tile[data-cat-id]').forEach((tile) => {
      tile.addEventListener('click', (e) => {
        e.stopPropagation();
        state.form.category_id = Number(tile.dataset.catId);
        wrap.querySelectorAll('.dk-cat-tile').forEach((t) => t.classList.remove('active'));
        tile.classList.add('active');
      });
    });
    const req = $('cat-request');
    if (req) req.addEventListener('click', (e) => { e.stopPropagation(); openCategoryRequest(); });
  }

  function renderFilterCategoryPills() {
    const wrap = $('flt-cat');
    if (!wrap) return;
    wrap.innerHTML = `<button type="button" class="dk-pill active" data-cat="">همه</button>` +
      state.categories.map((c) =>
        `<button type="button" class="dk-pill" data-cat="${c.id}">${c.icon || ''} ${escapeHtml(c.name)}</button>`
      ).join('');
    wrap.querySelectorAll('.dk-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        wrap.querySelectorAll('.dk-pill').forEach((x) => x.classList.remove('active'));
        btn.classList.add('active');
        state.filters.category_id = btn.dataset.cat ? Number(btn.dataset.cat) : '';
        txLog('filter', `category pill → id=${state.filters.category_id || 'all'}`);
      });
    });
  }

  async function openCategoryRequest() {
    const value = await window.DakhlyarModal.prompt({
      title: 'درخواست دسته جدید',
      message: 'نام دسته‌بندی پیشنهادی را وارد کنید.',
      placeholder: 'مثلاً: ورزش',
      confirmText: 'ارسال درخواست',
    });
    if (!value) return;
    const name = String(value).trim();
    if (name.length < 2) return window.DakhlyarModal.alert({ subType: 'warning', message: 'نام بسیار کوتاه است' });
    try {
      await api('/api/categories/request', {
        method: 'POST',
        body: JSON.stringify({ name, type: state.form.type, icon: '📌', color: '#6366F1' }),
      });
      window.DakhlyarModal.alert({ subType: 'success', message: 'درخواست شما ارسال شد و پس از تایید ادمین اضافه می‌شود.' });
    } catch (err) {
      window.DakhlyarModal.alert({ subType: 'error', message: err.message });
    }
  }

  /* ─────────────────────── STEP 9 — ADD / EDIT FORM ─────────────── */
  function resetForm() {
    state.editingId = null;
    state.form = {
      type: 'expense',
      amount: 0,
      category_id: null,
      title: '',
      note: '',
      tags: [],
      transaction_date: todayGreg(),
      transaction_time: null,
      is_recurring: false,
      recurring_interval: 'monthly',
    };
    fillForm();
    $('edit-sheet-title').textContent = 'ثبت تراکنش جدید';
    $('btn-submit-tx').textContent = 'ثبت تراکنش';
  }

  function fillForm() {
    const J = window.Jalali;
    document.querySelectorAll('#edit-sheet .dk-type-toggle .pill').forEach((p) =>
      p.classList.toggle('active', p.dataset.type === state.form.type)
    );
    $('fld-amount').value = state.form.amount || '';
    updateAmountFormatted();
    $('fld-title').value = state.form.title || '';
    updateCharCount('fld-title', 'title-count', 60);
    const j = J.jStrFromGregorian(state.form.transaction_date || todayGreg());
    $('fld-date').value = pd(j);
    $('fld-date-pretty').textContent = J.formatJalaliFromGregorian(state.form.transaction_date || todayGreg());
    $('fld-time').value = state.form.transaction_time || '';
    $('fld-note').value = state.form.note || '';
    updateCharCount('fld-note', 'note-count', 500);
    renderTagPills();
    const sw = $('fld-recurring-switch');
    sw.classList.toggle('on', !!state.form.is_recurring);
    sw.setAttribute('aria-checked', state.form.is_recurring ? 'true' : 'false');
    $('fld-interval').style.display = state.form.is_recurring ? 'flex' : 'none';
    document.querySelectorAll('#fld-interval button').forEach((b) =>
      b.classList.toggle('active', b.dataset.interval === state.form.recurring_interval)
    );
    renderCategoryGrid();
  }

  function openAdd() {
    resetForm();
    openSheet('edit-sheet');
  }

  function openEditExisting(it) {
    state.editingId = it.id;
    state.form = {
      type: it.type,
      amount: Number(it.amount),
      category_id: it.category ? Number(it.category.id) : null,
      title: it.title || '',
      note: it.note || '',
      tags: Array.isArray(it.tags) ? [...it.tags] : [],
      transaction_date: it.transaction_date,
      transaction_time: it.transaction_time || null,
      is_recurring: !!it.is_recurring,
      recurring_interval: it.recurring_interval || 'monthly',
    };
    fillForm();
    $('edit-sheet-title').textContent = 'ویرایش تراکنش';
    $('btn-submit-tx').textContent = 'ذخیره تغییرات';
    openSheet('edit-sheet');
  }

  function updateAmountFormatted() {
    const raw = arabicToEn($('fld-amount').value).replace(/[^0-9]/g, '');
    state.form.amount = raw ? parseInt(raw, 10) : 0;
    $('fld-amount-formatted').textContent = state.form.amount
      ? `${formatAmount(state.form.amount)} تومان` : '۰ تومان';
  }

  function updateCharCount(inputId, counterId, max) {
    const len = $(inputId).value.length;
    $(counterId).textContent = `${pd(len)}/${pd(max)}`;
  }

  function renderTagPills() {
    const wrap = $('fld-tags');
    wrap.querySelectorAll('.pill').forEach((p) => p.remove());
    const input = $('fld-tag-input');
    state.form.tags.forEach((t, idx) => {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.innerHTML = `${escapeHtml(t)} <span class="x" data-idx="${idx}">×</span>`;
      pill.querySelector('.x').addEventListener('click', () => {
        state.form.tags.splice(idx, 1);
        renderTagPills();
      });
      wrap.insertBefore(pill, input);
    });
    renderTagSuggestions();
  }

  async function loadTags() {
    try {
      const data = await api('/api/transactions/tags');
      state.tags = data.tags || [];
      renderTagSuggestions();
    } catch (_) {}
  }

  function renderTagSuggestions() {
    const wrap = $('fld-tag-suggestions');
    if (!wrap) return;
    const inUse = new Set(state.form.tags);
    const candidates = state.tags.filter((t) => !inUse.has(t.name)).slice(0, 8);
    if (!candidates.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = candidates.map((t) =>
      `<button class="pill" type="button" data-name="${escapeHtml(t.name)}">#${escapeHtml(t.name)}</button>`
    ).join('');
    wrap.querySelectorAll('.pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.form.tags.length >= 5)
          return window.DakhlyarModal.alert({ subType: 'warning', message: 'حداکثر ۵ تگ مجاز است' });
        const name = btn.dataset.name;
        if (!state.form.tags.includes(name)) state.form.tags.push(name);
        renderTagPills();
      });
    });
  }

  // Wire form inputs
  document.querySelectorAll('#edit-sheet .dk-type-toggle .pill').forEach((p) => {
    p.addEventListener('click', (e) => {
      e.stopPropagation();
      state.form.type = p.dataset.type;
      txLog('form', `type → ${state.form.type}`);
      document.querySelectorAll('#edit-sheet .dk-type-toggle .pill').forEach((x) => x.classList.remove('active'));
      p.classList.add('active');
      const cat = state.categories.find((c) => c.id === state.form.category_id);
      if (cat && cat.type !== 'both' && cat.type !== state.form.type) state.form.category_id = null;
      renderCategoryGrid();
    });
  });
  on($('fld-amount'), 'input', updateAmountFormatted, 'fld-amount');
  on($('fld-title'), 'input', () => {
    state.form.title = $('fld-title').value;
    updateCharCount('fld-title', 'title-count', 60);
  }, 'fld-title');
  on($('fld-note'), 'input', () => {
    state.form.note = $('fld-note').value;
    updateCharCount('fld-note', 'note-count', 500);
  }, 'fld-note');
  $('fld-date').addEventListener('input', () => {
    const j = arabicToEn($('fld-date').value).replace(/[^0-9-]/g, '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(j)) {
      const g = window.Jalali.gStrFromJalali(j);
      if (g) {
        state.form.transaction_date = g;
        $('fld-date-pretty').textContent = window.Jalali.formatJalaliFromGregorian(g);
      }
    } else {
      $('fld-date-pretty').textContent = '';
    }
  });
  $('fld-time').addEventListener('input', () => {
    state.form.transaction_time = $('fld-time').value || null;
  });
  $('fld-tag-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '،') {
      e.preventDefault();
      const raw = $('fld-tag-input').value.trim().replace(/^#/, '');
      if (!raw) return;
      if (state.form.tags.length >= 5)
        return window.DakhlyarModal.alert({ subType: 'warning', message: 'حداکثر ۵ تگ مجاز است' });
      if (raw.length > 20)
        return window.DakhlyarModal.alert({ subType: 'warning', message: 'هر تگ حداکثر ۲۰ کاراکتر' });
      if (!state.form.tags.includes(raw)) state.form.tags.push(raw);
      $('fld-tag-input').value = '';
      renderTagPills();
    } else if (e.key === 'Backspace' && !$('fld-tag-input').value && state.form.tags.length) {
      state.form.tags.pop();
      renderTagPills();
    }
  });
  $('fld-recurring-switch').addEventListener('click', () => {
    state.form.is_recurring = !state.form.is_recurring;
    const sw = $('fld-recurring-switch');
    sw.classList.toggle('on', state.form.is_recurring);
    sw.setAttribute('aria-checked', String(state.form.is_recurring));
    $('fld-interval').style.display = state.form.is_recurring ? 'flex' : 'none';
  });
  document.querySelectorAll('#fld-interval button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#fld-interval button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.form.recurring_interval = b.dataset.interval;
    });
  });

  async function submitForm() {
    if (!state.form.amount || state.form.amount <= 0)
      return window.DakhlyarModal.alert({ subType: 'warning', message: 'مبلغ باید بزرگ‌تر از صفر باشد' });
    if (!state.form.category_id)
      return window.DakhlyarModal.alert({ subType: 'warning', message: 'یک دسته‌بندی انتخاب کنید' });
    if (!state.form.title.trim())
      return window.DakhlyarModal.alert({ subType: 'warning', message: 'عنوان الزامی است' });

    const payload = {
      type: state.form.type,
      amount: state.form.amount,
      category_id: state.form.category_id,
      title: state.form.title.trim(),
      note: state.form.note ? state.form.note.trim() : null,
      tags: state.form.tags,
      transaction_date: state.form.transaction_date,
      transaction_time: state.form.transaction_time,
      is_recurring: !!state.form.is_recurring,
      recurring_interval: state.form.is_recurring ? state.form.recurring_interval : null,
    };

    const token = window.DakhlyarModal.loading({ message: state.editingId ? 'در حال ذخیره…' : 'در حال ثبت…' });
    try {
      if (state.editingId) {
        await api(`/api/transactions/${state.editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await api('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
      }
      window.DakhlyarModal.closeLoading(token);
      const wasEdit = !!state.editingId;
      closeSheet('edit-sheet');
      showToast(wasEdit ? 'تراکنش ویرایش شد' : 'تراکنش با موفقیت ثبت شد', 'success');
      await loadAndReset();
      loadTags();
    } catch (err) {
      window.DakhlyarModal.closeLoading(token);
      window.DakhlyarModal.alert({ subType: 'error', message: err.message });
    }
  }

  on($('btn-submit-tx'), 'click', () => {
    txLog('form', 'submit clicked', { type: state.form.type, amount: state.form.amount, category_id: state.form.category_id });
    submitForm();
  }, 'btn-submit-tx');

  /* ─────────────────────── STEP 10 — FILTER SHEET ───────────────── */
  function syncFilterUI() {
    document.querySelectorAll('#flt-type .dk-pill').forEach((x) =>
      x.classList.toggle('active', x.dataset.type === (state.filters.type || ''))
    );
    document.querySelectorAll('#flt-range .dk-pill').forEach((x) =>
      x.classList.toggle('active', x.dataset.range === state.filters.range)
    );
    const catWrap = $('flt-cat');
    if (catWrap) {
      catWrap.querySelectorAll('.dk-pill').forEach((x) => {
        const isAll = x.dataset.cat === '';
        x.classList.toggle(
          'active',
          isAll ? state.filters.category_id === '' : Number(x.dataset.cat) === Number(state.filters.category_id)
        );
      });
    }
    const search = $('flt-search');
    if (search) search.value = state.filters.search || '';
  }

  $('btn-filter').addEventListener('click', () => {
    syncFilterUI();
    openSheet('filter-sheet');
  });

  document.querySelectorAll('#flt-type .dk-pill').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#flt-type .dk-pill').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.filters.type = b.dataset.type;
    });
  });

  document.querySelectorAll('#flt-range .dk-pill').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#flt-range .dk-pill').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.filters.range = b.dataset.range;
    });
  });

  $('flt-search').addEventListener('input', () => {
    state.filters.search = $('flt-search').value.trim();
  });

  $('btn-filter-reset').addEventListener('click', () => {
    state.filters = { type: '', category_id: '', range: 'this-month', search: '' };
    syncFilterUI();
  });

  $('btn-filter-apply').addEventListener('click', async () => {
    closeSheet('filter-sheet');
    await loadAndReset();
  });

  /* ─────────────────────── STEP 11 — IMPORT SHEET ───────────────── */
  $('btn-import').addEventListener('click', () => {
    $('import-result').innerHTML = '';
    $('import-file').value = '';
    openSheet('import-sheet');
  });

  on($('btn-download-sample'), 'click', (e) => {
    e.stopPropagation();
    txLog('import', 'download sample CSV');
    window.location.href = '/api/transactions/sample-csv';
  }, 'btn-download-sample');

  $('btn-start-import').addEventListener('click', async () => {
    const f = $('import-file').files[0];
    if (!f) return window.DakhlyarModal.alert({ subType: 'warning', message: 'یک فایل انتخاب کنید' });
    if (f.size > 2 * 1024 * 1024)
      return window.DakhlyarModal.alert({ subType: 'error', message: 'حجم فایل بیش از ۲ مگابایت است' });
    const fd = new FormData();
    fd.append('file', f);
    const token = window.DakhlyarModal.loading({ message: 'در حال پردازش فایل…' });
    try {
      const res = await fetch('/api/transactions/import', { method: 'POST', body: fd, credentials: 'same-origin' });
      const data = await res.json();
      window.DakhlyarModal.closeLoading(token);
      if (!res.ok) return window.DakhlyarModal.alert({ subType: 'error', message: data.message || 'خطا در پردازش' });
      $('import-result').innerHTML =
        `<div class="dk-import-stat"><strong>${pd(data.imported || 0)}</strong> تراکنش وارد شد</div>` +
        (data.failed ? `<div class="dk-import-stat error"><strong>${pd(data.failed)}</strong> تراکنش رد شد</div>` : '') +
        (data.errors?.length ? '<ul class="dk-error-list">' + data.errors.map((e) => `<li>ردیف ${pd(e.row)}: ${escapeHtml(e.message)}</li>`).join('') + '</ul>' : '');
      await loadAndReset();
    } catch (err) {
      window.DakhlyarModal.closeLoading(token);
      window.DakhlyarModal.alert({ subType: 'error', message: err.message });
    }
  });

  /* ─────────────────────── STEP 12 — FAB + BOOT ─────────────────── */
  on($('btn-add-transaction'), 'click', () => {
    txLog('fab', 'open add form');
    openAdd();
  }, 'btn-add-transaction');

  async function boot() {
    txLog('boot', `starting v=${TX_VERSION}`);
    try {
      await loadCategories();
      txLog('boot', `categories loaded: ${state.categories.length}`);
      await loadAndReset();
      txLog('boot', `transactions loaded: ${state.items.length} items`);
      loadTags();
      txLog('boot', 'ready ✓ — open DevTools Console to see click logs');
    } catch (err) {
      txErr('boot', 'boot failed', err);
      window.DakhlyarModal.alert({ subType: 'error', title: 'خطا', message: 'بارگذاری صفحه تراکنش‌ها ناموفق بود: ' + err.message });
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
