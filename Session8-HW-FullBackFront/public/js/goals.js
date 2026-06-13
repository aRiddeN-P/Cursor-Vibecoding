(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => window.toPersianDigits(n);
  const fmt = (n) => pd(Number(n).toLocaleString('en'));
  const J = window.Jalali;

  const EMOJIS = ['🎯', '💻', '🚗', '✈️', '🏠', '💍', '📱', '🎓', '🏖️', '💰'];
  const COLORS = ['#1A5C3A', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#78716C'];

  let goalsData = { goals: [], total_saved: 0, total_target: 0 };
  let showCompleted = false;
  let editingGoalId = null;
  let amountGoalId = null;
  let amountMode = 'contribute';

  function getCurrentMonth() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

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
    if (res.status === 401) { window.location.href = '/'; throw new Error('unauthorized'); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
    return body;
  }

  function parseAmount(str) {
    const n = parseInt(String(str || '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function bindAmountInput(inputId, fmtId) {
    const input = $(inputId);
    const fmtEl = $(fmtId);
    if (!input || !fmtEl) return;
    input.addEventListener('input', () => {
      const raw = parseAmount(input.value);
      input.value = raw ? String(raw) : '';
      fmtEl.textContent = fmt(raw) + ' تومان';
    });
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
    if (id === 'goal-form-sheet') resetForm();
    if (!document.querySelectorAll('.dk-sheet.show').length) {
      $('sheet-overlay').classList.remove('show');
    }
  }

  function progressClass(pct, completed) {
    if (completed || pct >= 100) return 'complete';
    if (pct >= 80) return 'high';
    if (pct >= 50) return 'mid';
    return 'low';
  }

  function formatDeadline(deadline) {
    if (!deadline) return '';
    try {
      return J.formatJalaliShort(deadline);
    } catch (_) {
      return deadline;
    }
  }

  function renderSummary() {
    const { total_saved, total_target, goals } = goalsData;
    $('sum-saved').textContent = fmt(total_saved) + ' تومان';
    const pct = total_target > 0 ? Math.min(100, Math.round((total_saved / total_target) * 100)) : 0;
    $('sum-progress').style.width = pct + '%';
    const active = goals.filter((g) => !g.is_completed).length;
    const completed = goals.filter((g) => g.is_completed).length;
    $('sum-meta').textContent =
      total_target > 0
        ? `${pd(pct)}٪ از مجموع اهداف — ${pd(active)} هدف فعال${completed ? `، ${pd(completed)} تکمیل‌شده` : ''}`
        : (active ? `${pd(active)} هدف فعال` : 'هدفی ثبت نشده');
  }

  function renderGoalCard(g) {
    const overdue = g.deadline && g.days_remaining != null && g.days_remaining <= 0 && !g.is_completed;
    const collapsed = g.is_completed && !showCompleted ? ' collapsed' : '';
    const pctClass = progressClass(g.percentage, g.is_completed);
    let deadlineHtml = '';
    if (g.deadline) {
      const dlClass = overdue ? ' overdue' : '';
      let line = `تا ${formatDeadline(g.deadline)}`;
      if (g.monthly_needed && !g.is_completed && g.days_remaining > 0) {
        line += ` — ماهی ${fmt(g.monthly_needed)} تومان`;
      }
      if (overdue) line = 'مهلت گذشته — ' + formatDeadline(g.deadline);
      deadlineHtml = `<div class="goal-deadline${dlClass}">${line}</div>`;
    }
    const badge = g.is_completed
      ? '<span class="goal-badge done">تکمیل شد 🎉</span>'
      : (overdue ? '<span class="goal-badge overdue">مهلت گذشته</span>' : '');

    const btns = g.is_completed
      ? `<button type="button" class="goal-btn history" data-history="${g.id}">تاریخچه</button>`
      : `<button type="button" class="goal-btn contribute" data-contribute="${g.id}">+ واریز</button>
         <button type="button" class="goal-btn withdraw" data-withdraw="${g.id}">− برداشت</button>
         <button type="button" class="goal-btn history" data-history="${g.id}">تاریخچه</button>`;

    return `<div class="goal-card${g.is_completed ? ' completed' : ''}${overdue ? ' overdue' : ''}${collapsed}"
                 data-id="${g.id}">
      <div class="goal-header">
        <div class="goal-icon-title">
          <span class="goal-icon">${g.icon || '🎯'}</span>
          <span>${badge}${g.title}</span>
        </div>
        <div class="goal-actions">
          <button type="button" data-edit="${g.id}" aria-label="ویرایش">✏️</button>
          <button type="button" data-delete="${g.id}" aria-label="حذف">🗑️</button>
        </div>
      </div>
      <div class="goal-body">
        <div class="goal-amounts">
          <strong>${fmt(g.saved_amount)}</strong> از ${fmt(g.target_amount)} تومان
        </div>
        <div class="goal-progress-wrap">
          <div class="goal-progress-fill ${pctClass}" style="width:${Math.min(100, g.percentage)}%"></div>
        </div>
        <div class="goal-pct">${pd(g.percentage)}٪</div>
        <div class="goal-amounts">${fmt(g.remaining)} تومان مانده</div>
        ${deadlineHtml}
        <div class="goal-btns">${btns}</div>
      </div>
    </div>`;
  }

  function renderGoalsList() {
    const list = $('goals-list');
    const visible = goalsData.goals.filter((g) => showCompleted || !g.is_completed);
    const completedCount = goalsData.goals.filter((g) => g.is_completed).length;
    const header = $('goals-list-header');

    if (!goalsData.goals.length) {
      list.innerHTML = '';
      if (header) header.style.display = 'none';
      $('goals-empty').style.display = 'block';
      $('toggle-completed').style.display = 'none';
      return;
    }

    $('goals-empty').style.display = 'none';
    if (header) header.style.display = 'flex';
    list.innerHTML = visible.map(renderGoalCard).join('') +
      `<button type="button" class="goals-add-more" id="btn-add-goal-more">
        <i class="ti ti-plus"></i> افزودن هدف دیگر
      </button>`;

    $('btn-add-goal-more')?.addEventListener('click', openAddForm);

    const toggle = $('toggle-completed');
    if (completedCount > 0) {
      toggle.style.display = 'block';
      toggle.textContent = showCompleted
        ? 'پنهان کردن اهداف تکمیل‌شده'
        : `نمایش اهداف تکمیل‌شده (${pd(completedCount)})`;
    } else {
      toggle.style.display = 'none';
    }
  }

  async function renderForecast() {
    try {
      const month = getCurrentMonth();
      const fc = await api('/api/reports/cash-flow-forecast?month=' + month);
      const card = $('forecast-card');
      card.classList.toggle('negative', fc.projected_end_balance < 0);
      $('fc-current').textContent = fmt(fc.current_balance);
      $('fc-projected').textContent = fmt(fc.projected_end_balance);
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const elapsed = Math.min(lastDay, new Date().getUTCDate());
      const pct = Math.round((elapsed / lastDay) * 100);
      $('fc-progress').style.width = pct + '%';
      $('fc-days').textContent = `${pd(fc.days_remaining)} روز مانده (${pd(pct)}٪ ماه گذشته)`;
      const confMap = { low: ['low', 'اطمینان: پایین'], medium: ['medium', 'اطمینان: متوسط'], high: ['high', 'اطمینان: بالا'] };
      const [cls, label] = confMap[fc.confidence] || ['medium', fc.confidence];
      const badge = $('fc-confidence');
      badge.className = 'confidence-badge ' + cls;
      badge.textContent = label;
      $('fc-insight').textContent = fc.insight || '';
    } catch (err) {
      console.warn('[goals] forecast', err);
    }
  }

  async function renderZbb() {
    try {
      const zbb = await api('/api/budgets/zbb?month=' + getCurrentMonth());
      $('zbb-income').textContent = fmt(zbb.total_income);
      $('zbb-budgeted').textContent = fmt(zbb.total_budgeted);
      const bar = $('zbb-bar');
      bar.style.width = zbb.assignment_percent + '%';
      bar.classList.toggle('full', zbb.is_zero_based);
      const unEl = $('zbb-unassigned');
      unEl.textContent = fmt(zbb.unassigned);
      unEl.className = 'unassigned-amount' + (zbb.is_zero_based ? ' zero' : (zbb.unassigned > 0 ? ' pulse' : ''));
      $('zbb-success').style.display = zbb.is_zero_based ? 'block' : 'none';
    } catch (err) {
      console.warn('[goals] zbb', err);
    }
  }

  async function loadGoals() {
    goalsData = await api('/api/goals?include_completed=true');
    renderSummary();
    renderGoalsList();
  }

  async function refreshAll() {
    $('goals-loading').style.display = 'block';
    $('goals-content').style.display = 'none';
    await Promise.all([loadGoals(), renderForecast(), renderZbb()]);
    $('goals-loading').style.display = 'none';
    $('goals-content').style.display = 'block';
  }

  function initFormSheet() {
    const emojiRow = $('gf-emoji-row');
    emojiRow.innerHTML = EMOJIS.map((e) =>
      `<button type="button" class="gl-emoji-btn" data-emoji="${e}">${e}</button>`
    ).join('');
    emojiRow.querySelectorAll('.gl-emoji-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        emojiRow.querySelectorAll('.gl-emoji-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        $('gf-emoji-custom').value = '';
      });
    });

    const colorRow = $('gf-color-row');
    colorRow.innerHTML = COLORS.map((c) =>
      `<button type="button" class="gl-color-swatch" data-color="${c}" style="background:${c}" aria-label="رنگ"></button>`
    ).join('');
    colorRow.querySelectorAll('.gl-color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        colorRow.querySelectorAll('.gl-color-swatch').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    $('gf-title').addEventListener('input', () => {
      $('gf-title-count').textContent = pd($('gf-title').value.length) + '/۶۰';
    });

    $('gf-deadline').addEventListener('input', () => {
      const v = $('gf-deadline').value.trim();
      $('gf-deadline-pretty').textContent = '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
      try {
        const g = J.gStrFromJalali(v);
        $('gf-deadline-pretty').textContent = J.formatJalaliShort(g);
      } catch (_) { /* ignore */ }
    });
  }

  function resetForm() {
    editingGoalId = null;
    $('goal-form-title').textContent = 'هدف جدید';
    $('gf-title').value = '';
    $('gf-target').value = '';
    $('gf-target-fmt').textContent = '۰ تومان';
    $('gf-initial').value = '';
    $('gf-initial-fmt').textContent = '۰ تومان';
    $('gf-deadline').value = '';
    $('gf-deadline-pretty').textContent = '';
    $('gf-emoji-custom').value = '';
    $('gf-title-count').textContent = '۰/۶۰';
    $('gf-initial-wrap').style.display = 'block';
    $('gf-emoji-row').querySelectorAll('.gl-emoji-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    $('gf-color-row').querySelectorAll('.gl-color-swatch').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
  }

  function openAddForm() {
    resetForm();
    openSheet('goal-form-sheet');
  }

  function openEditForm(goal) {
    editingGoalId = goal.id;
    $('goal-form-title').textContent = 'ویرایش هدف';
    $('gf-title').value = goal.title;
    $('gf-target').value = String(goal.target_amount);
    $('gf-target-fmt').textContent = fmt(goal.target_amount) + ' تومان';
    $('gf-initial-wrap').style.display = 'none';
    if (goal.deadline) {
      try { $('gf-deadline').value = J.jStrFromGregorian(goal.deadline); } catch (_) {}
    }
    $('gf-emoji-row').querySelectorAll('.gl-emoji-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.emoji === goal.icon);
    });
    $('gf-color-row').querySelectorAll('.gl-color-swatch').forEach((b) => {
      b.classList.toggle('active', b.dataset.color === goal.color);
    });
    $('gf-title-count').textContent = pd(goal.title.length) + '/۶۰';
    openSheet('goal-form-sheet');
  }

  function getSelectedEmoji() {
    const custom = $('gf-emoji-custom').value.trim();
    if (custom) return custom.slice(0, 4);
    const active = $('gf-emoji-row').querySelector('.gl-emoji-btn.active');
    return active ? active.dataset.emoji : '🎯';
  }

  function getSelectedColor() {
    const active = $('gf-color-row').querySelector('.gl-color-swatch.active');
    return active ? active.dataset.color : '#1A5C3A';
  }

  async function submitGoalForm() {
    const title = $('gf-title').value.trim();
    const target_amount = parseAmount($('gf-target').value);
    if (!title) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: 'عنوان هدف را وارد کنید', type: 'danger' });
      return;
    }
    if (target_amount <= 0) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: 'مبلغ هدف باید بزرگ‌تر از صفر باشد', type: 'danger' });
      return;
    }
    const icon = getSelectedEmoji();
    const color = getSelectedColor();
    let deadline = null;
    const jDeadline = $('gf-deadline').value.trim();
    if (jDeadline) {
      try { deadline = J.gStrFromJalali(jDeadline); } catch (_) {
        window.DakhlyarModal?.alert({ title: 'خطا', message: 'تاریخ شمسی نامعتبر است', type: 'danger' });
        return;
      }
    }

    try {
      const wasEdit = !!editingGoalId;
      if (editingGoalId) {
        await api('/api/goals/' + editingGoalId, {
          method: 'PATCH',
          body: { title, target_amount, icon, color, deadline },
        });
      } else {
        const initial_amount = parseAmount($('gf-initial').value);
        await api('/api/goals', {
          method: 'POST',
          body: { title, target_amount, icon, color, deadline, initial_amount },
        });
      }
      closeSheet('goal-form-sheet');
      resetForm();
      await refreshAll();
      window.DakhlyarModal?.alert({
        title: wasEdit ? 'ذخیره شد' : 'هدف جدید',
        message: wasEdit
          ? 'تغییرات هدف ذخیره شد.'
          : 'هدف با موفقیت ثبت شد. می‌توانید هدف‌های بیشتری اضافه کنید.',
        subType: 'success',
      });
    } catch (err) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: err.message, type: 'danger' });
    }
  }

  function openAmountSheet(goalId, mode) {
    amountGoalId = goalId;
    amountMode = mode;
    $('amount-sheet-title').textContent = mode === 'contribute' ? 'واریز به هدف' : 'برداشت از هدف';
    $('af-amount').value = '';
    $('af-amount-fmt').textContent = '۰ تومان';
    $('af-note').value = '';
    openSheet('amount-sheet');
  }

  async function submitAmount() {
    const amount = parseAmount($('af-amount').value);
    if (amount <= 0) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: 'مبلغ باید بزرگ‌تر از صفر باشد', type: 'danger' });
      return;
    }
    const path = amountMode === 'contribute'
      ? `/api/goals/${amountGoalId}/contribute`
      : `/api/goals/${amountGoalId}/withdraw`;
    try {
      await api(path, { method: 'POST', body: { amount, note: $('af-note').value.trim() || undefined } });
      closeSheet('amount-sheet');
      await refreshAll();
    } catch (err) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: err.message, type: 'danger' });
    }
  }

  async function openHistory(goalId) {
    const goal = goalsData.goals.find((g) => g.id === goalId);
    $('history-sheet-title').textContent = 'تاریخچه — ' + (goal ? goal.title : '');
    try {
      const data = await api('/api/goals/' + goalId + '/history');
      const list = $('history-list');
      if (!data.contributions.length) {
        list.innerHTML = '<p style="text-align:center;color:var(--color-text-3);font-size:13px;">تاریخچه‌ای ثبت نشده</p>';
      } else {
        list.innerHTML = data.contributions.map((c) => {
          const pos = c.amount > 0;
          const dir = pos ? '↑' : '↓';
          const label = pos ? 'واریز' : 'برداشت';
          let dateStr = c.contributed_at;
          try {
            dateStr = J.formatJalaliShort(String(c.contributed_at).slice(0, 10));
          } catch (_) { /* keep raw */ }
          return `<div class="gl-history-item">
            <span class="dir">${dir}</span>
            <div>
              <div>${label}: <span class="amt ${pos ? 'pos' : 'neg'}">${fmt(Math.abs(c.amount))} تومان</span></div>
              <div class="meta">${dateStr}${c.note ? ' — ' + c.note : ''}</div>
            </div>
          </div>`;
        }).join('');
      }
      openSheet('history-sheet');
    } catch (err) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: err.message, type: 'danger' });
    }
  }

  function bindEvents() {
    $('sheet-overlay').addEventListener('click', () => {
      if ($('goal-form-sheet')?.classList.contains('show')) resetForm();
      document.querySelectorAll('.dk-sheet.show').forEach((s) => s.classList.remove('show'));
      $('sheet-overlay').classList.remove('show');
    });
    document.querySelectorAll('[data-close-sheet]').forEach((b) => {
      b.addEventListener('click', () => closeSheet(b.dataset.closeSheet));
    });

    $('btn-add-goal').addEventListener('click', openAddForm);
    $('btn-add-goal-inline')?.addEventListener('click', openAddForm);
    $('fab-add-goal')?.addEventListener('click', openAddForm);
    $('btn-empty-add').addEventListener('click', openAddForm);
    $('gf-submit').addEventListener('click', submitGoalForm);
    $('af-submit').addEventListener('click', submitAmount);
    $('btn-zbb-budget').addEventListener('click', () => { window.location.href = '/reports.html#budget'; });
    $('toggle-completed').addEventListener('click', async () => {
      showCompleted = !showCompleted;
      renderGoalsList();
    });

    $('goals-list').addEventListener('click', async (e) => {
      const t = e.target.closest('[data-edit],[data-delete],[data-contribute],[data-withdraw],[data-history]');
      if (!t) return;
      const id = Number(t.dataset.edit || t.dataset.delete || t.dataset.contribute || t.dataset.withdraw || t.dataset.history);
      if (t.dataset.edit) {
        const goal = goalsData.goals.find((g) => g.id === id);
        if (goal) openEditForm(goal);
      } else if (t.dataset.delete) {
        const ok = await window.DakhlyarModal.confirm({
          title: 'حذف هدف',
          message: 'این هدف و تاریخچه‌اش حذف شود؟',
          confirmText: 'بله',
          cancelText: 'انصراف',
          type: 'danger',
        });
        if (!ok) return;
        try {
          await api('/api/goals/' + id, { method: 'DELETE' });
          await refreshAll();
        } catch (err) {
          window.DakhlyarModal?.alert({ title: 'خطا', message: err.message, type: 'danger' });
        }
      } else if (t.dataset.contribute) {
        openAmountSheet(id, 'contribute');
      } else if (t.dataset.withdraw) {
        openAmountSheet(id, 'withdraw');
      } else if (t.dataset.history) {
        openHistory(id);
      }
    });
  }

  bindAmountInput('gf-target', 'gf-target-fmt');
  bindAmountInput('gf-initial', 'gf-initial-fmt');
  bindAmountInput('af-amount', 'af-amount-fmt');
  initFormSheet();
  bindEvents();
  refreshAll();
})();
