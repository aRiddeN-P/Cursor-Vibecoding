(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => window.toPersianDigits(n);
  const fmt = (n) => pd(Number(n).toLocaleString('en'));

  let currentMonth = null;
  let categories = [];

  async function api(path, opts = {}) {
    const res = await fetch(path, Object.assign({
      credentials: 'same-origin',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    }, opts));
    if (res.status === 401) { window.location.href = '/'; throw new Error('unauthorized'); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
    return body;
  }

  function getCurrentMonth() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function openSheet(id) {
    document.querySelectorAll('.dk-sheet.show').forEach((s) => {
      if (s.id !== id) s.classList.remove('show');
    });
    $('sheet-overlay').classList.add('show');
    const s = $(id);
    if (s) requestAnimationFrame(() => s.classList.add('show'));
  }

  function closeSheet(id) {
    const s = $(id);
    if (s) s.classList.remove('show');
    if (!document.querySelectorAll('.dk-sheet.show').length) {
      $('sheet-overlay').classList.remove('show');
    }
  }

  $('sheet-overlay').addEventListener('click', () => {
    document.querySelectorAll('.dk-sheet.show').forEach((s) => s.classList.remove('show'));
    $('sheet-overlay').classList.remove('show');
  });
  document.querySelectorAll('[data-close-sheet]').forEach((b) => {
    b.addEventListener('click', () => closeSheet(b.dataset.closeSheet));
  });

  async function loadCategories() {
    const data = await api('/api/categories');
    categories = (data.categories || []).filter((c) => c.type === 'expense' || c.type === 'both');
    const sel = $('bg-add-cat');
    sel.innerHTML = categories.map((c) =>
      `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`
    ).join('');
  }

  async function renderZbb() {
    const zbb = await api('/api/budgets/zbb?month=' + currentMonth);
    const el = $('bg-zbb');
    el.className = 'bg-zbb' + (zbb.is_zero_based ? ' success' : zbb.unassigned > 0 ? ' danger' : '');
    el.innerHTML = `
      درآمد این ماه: <strong>${fmt(zbb.total_income)}</strong> تومان |
      تخصیص‌نشده: <strong>${fmt(zbb.unassigned)}</strong> تومان
      ${zbb.is_zero_based ? '<br>همه درآمد شما تخصیص یافته است! 🎉' : ''}`;
  }

  async function renderBudgetList() {
    const data = await api('/api/budgets?month=' + currentMonth);
    const list = $('bg-list');
    if (!data.budgets.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--color-text-3);font-size:13px;">بودجه‌ای تنظیم نشده</p>';
      return;
    }
    list.innerHTML = data.budgets.map((b) => {
      const cat = b.category;
      return `<div class="bg-row" data-id="${b.id}">
        <div class="bg-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon || '📦'}</div>
        <div class="bg-info">
          <div class="bg-name">${cat.name}</div>
          <div class="bg-nums">${fmt(b.spent)} / ${fmt(b.amount)} تومان (${pd(b.percentage)}٪)</div>
          <div class="bg-bar ${b.status}"><i style="width:${Math.min(100, b.percentage)}%"></i></div>
        </div>
        <button type="button" class="icon-btn bg-del" data-id="${b.id}" aria-label="حذف"><i class="ti ti-trash"></i></button>
      </div>`;
    }).join('');

    list.querySelectorAll('.bg-del').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await window.DakhlyarModal.confirm({
          title: 'حذف بودجه',
          message: 'این بودجه حذف شود؟',
          confirmText: 'بله',
          cancelText: 'انصراف',
          type: 'danger',
        });
        if (!ok) return;
        await api('/api/budgets/' + btn.dataset.id, { method: 'DELETE' });
        await refreshBudgetUI();
        if (window.DakhlyarReports) window.DakhlyarReports.reload();
      });
    });
  }

  async function refreshBudgetUI() {
    await renderZbb();
    await renderBudgetList();
  }

  async function openBudgetSheet(month) {
    currentMonth = month || getCurrentMonth();
    await loadCategories();
    await refreshBudgetUI();
    openSheet('budget-sheet');
  }

  $('btn-bg-add').addEventListener('click', () => openSheet('bg-add-sheet'));
  $('btn-bg-copy').addEventListener('click', async () => {
    try {
      const r = await api('/api/budgets/copy-from-last-month', {
        method: 'POST',
        body: JSON.stringify({ target_month: currentMonth }),
      });
      window.DakhlyarModal.alert({ subType: 'success', message: `${pd(r.copied)} بودجه کپی شد` });
      await refreshBudgetUI();
    } catch (err) {
      window.DakhlyarModal.alert({ subType: 'error', message: err.message });
    }
  });

  $('btn-bg-save').addEventListener('click', async () => {
    const raw = $('bg-add-amount').value.replace(/[^0-9]/g, '');
    const amount = parseInt(raw, 10);
    if (!amount || amount <= 0) {
      return window.DakhlyarModal.alert({ subType: 'warning', message: 'مبلغ بودجه نامعتبر است' });
    }
    try {
      await api('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({
          category_id: Number($('bg-add-cat').value),
          month: currentMonth,
          amount,
        }),
      });
      closeSheet('bg-add-sheet');
      $('bg-add-amount').value = '';
      await refreshBudgetUI();
      if (window.DakhlyarReports) window.DakhlyarReports.reload();
      window.DakhlyarModal.alert({ subType: 'success', message: 'بودجه ذخیره شد' });
    } catch (err) {
      window.DakhlyarModal.alert({ subType: 'error', message: err.message });
    }
  });

  window.DakhlyarBudget = { open: openBudgetSheet, getMonth: () => currentMonth || getCurrentMonth() };
})();
