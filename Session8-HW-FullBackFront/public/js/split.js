(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => (window.toPersianDigits ? window.toPersianDigits(n) : String(n));
  const fmt = (n) => pd(Number(n || 0).toLocaleString('en'));

  let groups = [];
  let currentGroupId = null;
  let groupData = null;
  let myUserId = null;
  let splitMode = 'equal';
  let pendingSettle = null;
  let lookupTimer = null;

  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.style.display = 'none'; }, 2500);
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

  function balanceClass(bal) {
    if (bal > 0) return 'owed';
    if (bal < 0) return 'owes';
    return 'even';
  }

  function balanceLabel(bal) {
    const cls = balanceClass(bal);
    const abs = fmt(Math.abs(bal));
    if (cls === 'owed') return `${abs} تومان طلبکار`;
    if (cls === 'owes') return `${abs} تومان بدهکار`;
    return 'تسویه‌شده';
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

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function showListView() {
    currentGroupId = null;
    groupData = null;
    $('list-header').style.display = '';
    $('detail-header').style.display = 'none';
    $('view-list').style.display = 'block';
    $('view-detail').style.display = 'none';
    $('fab-add-expense').style.display = 'none';
    history.replaceState(null, '', '/split.html');
  }

  function showDetailView(id) {
    currentGroupId = id;
    $('list-header').style.display = 'none';
    $('detail-header').style.display = '';
    $('view-list').style.display = 'none';
    $('view-detail').style.display = 'block';
    $('fab-add-expense').style.display = 'flex';
    history.replaceState(null, '', `/split.html?id=${id}`);
  }

  function renderGroupsList() {
    const wrap = $('groups-list');
    const empty = $('groups-empty');
    if (!groups.length) {
      wrap.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    wrap.innerHTML = groups.map((g) => {
      const cls = balanceClass(g.my_balance);
      return `
        <article class="split-group-card" data-gid="${g.id}">
          <div class="split-group-header">
            <span class="split-group-name">${g.name}</span>
            <span class="split-member-count">👥 ${pd(g.member_count)}</span>
          </div>
          <div class="split-group-total">مجموع هزینه: ${fmt(g.total_expenses)} تومان</div>
          <div class="split-group-balance ${cls}">مانده شما: ${balanceLabel(g.my_balance)}</div>
        </article>`;
    }).join('');

    wrap.querySelectorAll('.split-group-card').forEach((card) => {
      card.addEventListener('click', () => loadGroupDetail(Number(card.dataset.gid)));
    });
  }

  function groupExpensesByDate(expenses) {
    const map = new Map();
    for (const e of expenses) {
      const d = e.expense_date;
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(e);
    }
    return map;
  }

  function renderExpenses() {
    const el = $('expenses-list');
    if (!groupData || !groupData.expenses.length) {
      el.innerHTML = '<p class="split-empty" style="padding:24px;">هنوز هزینه‌ای ثبت نشده</p>';
      return;
    }
    const byDate = groupExpensesByDate(groupData.expenses);
    let html = '';
    for (const [date, items] of byDate) {
      const dateLabel = window.formatJalaliDate ? formatJalaliDate(date) : date;
      html += `<div class="split-date-label">${dateLabel}</div>`;
      for (const e of items) {
        const icon = e.category?.icon || '💸';
        const myShare = e.my_share;
        const shareHtml = myShare
          ? `<div class="split-expense-share${myShare.is_settled ? ' settled' : ''}">سهم شما: ${fmt(myShare.share_amount)}${myShare.is_settled ? ' ✓' : ''}</div>`
          : '';
        html += `
          <div class="split-expense-row">
            <div class="split-expense-icon">${icon}</div>
            <div class="split-expense-body">
              <div class="split-expense-title">${e.title}</div>
              <div class="split-expense-paid">پرداخت: ${e.paid_by?.display_name || '—'}</div>
              ${shareHtml}
            </div>
            <div class="split-expense-amount">
              <div class="split-expense-total">${fmt(e.amount)}</div>
            </div>
          </div>`;
      }
    }
    el.innerHTML = html;
  }

  function renderSettlements() {
    const sug = $('suggested-settlements');
    const done = $('completed-settlements');
    if (!groupData) return;

    if (!groupData.settlements.suggested.length) {
      sug.innerHTML = '<p style="font-size:13px;color:var(--color-text-3);">همه حساب‌ها تسویه است ✓</p>';
    } else {
      sug.innerHTML = groupData.settlements.suggested.map((s, i) => `
        <div class="settlement-card">
          <div class="settlement-info">
            <div class="settlement-names">${s.from.display_name} ← ${s.to.display_name}</div>
            <div class="settlement-amount">${fmt(s.amount)} تومان</div>
          </div>
          <button type="button" class="settlement-btn" data-settle="${i}">ثبت پرداخت</button>
        </div>`).join('');

      sug.querySelectorAll('[data-settle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const s = groupData.settlements.suggested[Number(btn.dataset.settle)];
          openSettleSheet(s);
        });
      });
    }

    if (!groupData.settlements.completed.length) {
      done.innerHTML = '<p style="font-size:13px;color:var(--color-text-3);">—</p>';
    } else {
      done.innerHTML = groupData.settlements.completed.map((s) => `
        <div class="settlement-done">
          ${s.from.display_name} به ${s.to.display_name}: ${fmt(s.amount)} تومان
          ${s.transaction_id ? ` · تراکنش #${pd(s.transaction_id)}` : ''}
        </div>`).join('');
    }
  }

  function renderMembers() {
    const el = $('members-list');
    if (!groupData) return;
    el.innerHTML = groupData.members.map((m) => {
      const cls = balanceClass(m.balance);
      const initial = m.display_name.slice(0, 1);
      return `
        <div class="member-balance-row">
          <div class="member-avatar">${initial}</div>
          <div class="member-name">${m.display_name}${m.is_registered ? ' ✓' : ''}</div>
          <div class="member-balance-val ${cls}">${balanceLabel(m.balance)}</div>
        </div>`;
    }).join('');

    const isCreator = groupData.group.created_by === myUserId;
    $('invite-row').style.display = 'flex';
    $('btn-add-member').style.display = isCreator ? 'block' : 'none';
  }

  function renderDetail() {
    if (!groupData) return;
    $('detail-name').textContent = groupData.group.name;
    $('detail-desc').textContent = groupData.group.description || '';
    $('detail-header-title').textContent = groupData.group.name;
    renderExpenses();
    renderSettlements();
    renderMembers();
  }

  async function loadGroups() {
    const data = await api('/api/split/groups');
    groups = data.groups || [];
    renderGroupsList();
  }

  async function loadGroupDetail(id) {
    groupData = await api('/api/split/groups/' + id);
    showDetailView(id);
    renderDetail();
  }

  function buildPayerPills() {
    const wrap = $('ef-payer-pills');
    if (!groupData) return;
    wrap.innerHTML = groupData.members.map((m, i) => `
      <button type="button" class="split-member-pill${i === 0 ? ' active' : ''}" data-mid="${m.id}">${m.display_name}</button>
    `).join('');
    wrap.querySelectorAll('.split-member-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.split-member-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function buildCustomShares() {
    const wrap = $('ef-custom-shares');
    if (!groupData) return;
    wrap.innerHTML = groupData.members.map((m) => `
      <div class="split-share-row">
        <span>${m.display_name}</span>
        <input type="tel" data-mid="${m.id}" inputmode="numeric" placeholder="۰" />
      </div>`).join('');
  }

  function getSelectedPayerId() {
    const active = $('ef-payer-pills').querySelector('.split-member-pill.active');
    return active ? Number(active.dataset.mid) : null;
  }

  function openExpenseSheet() {
    $('ef-title').value = '';
    $('ef-amount').value = '';
    $('ef-amount-fmt').textContent = '۰ تومان';
    $('ef-date').value = todayIso();
    $('ef-note').value = '';
    splitMode = 'equal';
    document.querySelectorAll('#expense-form-sheet .split-toggle button').forEach((b) => {
      b.classList.toggle('active', b.dataset.split === 'equal');
    });
    $('ef-custom-shares').classList.remove('show');
    buildPayerPills();
    buildCustomShares();
    openSheet('expense-form-sheet');
  }

  function openSettleSheet(s) {
    pendingSettle = s;
    $('settle-desc').textContent =
      `${s.from.display_name} باید ${fmt(s.amount)} تومان به ${s.to.display_name} بدهد. آیا می‌خواهید این تسویه را به عنوان تراکنش ثبت کنید؟`;
    $('settle-create-tx').checked = false;
    $('settle-date-row').style.display = 'none';
    $('btn-settle-tx').style.display = 'none';
    $('settle-date').value = todayIso();
    openSheet('settle-sheet');
  }

  async function saveGroup() {
    const name = $('gf-name').value.trim();
    if (!name) { toast('نام گروه الزامی است'); return; }
    const res = await api('/api/split/groups', {
      method: 'POST',
      body: { name, description: $('gf-desc').value.trim() || null, members: [] },
    });
    closeSheet('group-form-sheet');
    toast('گروه ایجاد شد');
    await loadGroups();
    if (res.group?.id) await loadGroupDetail(res.group.id);
  }

  async function saveExpense() {
    const title = $('ef-title').value.trim();
    const amount = parseAmount($('ef-amount').value);
    const paidBy = getSelectedPayerId();
    const expenseDate = $('ef-date').value;
    if (!title || amount <= 0 || !paidBy || !expenseDate) {
      toast('لطفاً فیلدهای الزامی را پر کنید');
      return;
    }
    const body = {
      title, amount, paid_by_member_id: paidBy,
      expense_date: expenseDate,
      split_type: splitMode,
      note: $('ef-note').value.trim() || null,
    };
    if (splitMode === 'custom') {
      const shares = [];
      $('ef-custom-shares').querySelectorAll('input[data-mid]').forEach((inp) => {
        shares.push({ member_id: Number(inp.dataset.mid), share_amount: parseAmount(inp.value) });
      });
      const sum = shares.reduce((s, x) => s + x.share_amount, 0);
      if (sum !== amount) {
        toast('مجموع سهم‌ها باید برابر مبلغ کل باشد');
        return;
      }
      body.shares = shares;
    }
    await api(`/api/split/groups/${currentGroupId}/expenses`, { method: 'POST', body });
    closeSheet('expense-form-sheet');
    toast('هزینه ثبت شد');
    await loadGroupDetail(currentGroupId);
    await loadGroups();
  }

  async function saveMember() {
    const display_name = $('mf-name').value.trim();
    const mobile = $('mf-mobile').value.trim() || null;
    if (!display_name) { toast('نام الزامی است'); return; }
    await api(`/api/split/groups/${currentGroupId}/members`, {
      method: 'POST',
      body: { display_name, mobile },
    });
    closeSheet('member-form-sheet');
    toast('عضو اضافه شد');
    await loadGroupDetail(currentGroupId);
  }

  async function submitSettle(createTx) {
    if (!pendingSettle || !currentGroupId) return;
    const body = {
      from_member_id: pendingSettle.from.id,
      to_member_id: pendingSettle.to.id,
      amount: pendingSettle.amount,
      create_transaction: createTx,
    };
    if (createTx) body.transaction_date = $('settle-date').value;
    await api(`/api/split/groups/${currentGroupId}/settle`, { method: 'POST', body });
    closeSheet('settle-sheet');
    toast('تسویه ثبت شد');
    pendingSettle = null;
    await loadGroupDetail(currentGroupId);
    await loadGroups();
  }

  function copyInviteLink() {
    if (!groupData?.group?.share_url) return;
    navigator.clipboard.writeText(groupData.group.share_url).then(() => {
      toast('لینک کپی شد');
    }).catch(() => toast('خطا در کپی'));
  }

  function shareInviteLink() {
    if (!groupData?.group?.share_url) return;
    const url = groupData.group.share_url;
    const title = groupData.group.name;
    if (navigator.share) {
      navigator.share({ title, text: 'لینک دنگ و دونگ', url }).catch(() => {});
    } else {
      copyInviteLink();
    }
  }

  async function lookupMobile() {
    const mobile = $('mf-mobile').value.trim();
    if (!mobile || mobile.length < 10) {
      $('mf-lookup-hint').textContent = '';
      return;
    }
    try {
      const r = await api('/api/split/lookup-mobile?mobile=' + encodeURIComponent(mobile));
      if (r.registered) {
        $('mf-lookup-hint').textContent = '✓ کاربر دخلیار: ' + r.display_name;
        if (!$('mf-name').value.trim()) $('mf-name').value = r.display_name;
      } else {
        $('mf-lookup-hint').textContent = 'کاربر ثبت‌نام‌شده یافت نشد — نام را دستی وارد کنید';
      }
    } catch (_) {
      $('mf-lookup-hint').textContent = '';
    }
  }

  function bindTabs() {
    document.querySelectorAll('.split-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.split-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.split-panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        $('panel-' + tab.dataset.tab).classList.add('active');
      });
    });
  }

  function bindEvents() {
    $('btn-add-group').addEventListener('click', () => {
      $('gf-name').value = '';
      $('gf-desc').value = '';
      openSheet('group-form-sheet');
    });
    $('btn-empty-group')?.addEventListener('click', () => $('btn-add-group').click());
    $('btn-save-group').addEventListener('click', () => saveGroup().catch((e) => toast(e.message)));
    $('btn-back-list').addEventListener('click', () => { showListView(); loadGroups(); });
    $('fab-add-expense').addEventListener('click', openExpenseSheet);
    $('btn-save-expense').addEventListener('click', () => saveExpense().catch((e) => toast(e.message)));
    $('btn-add-member').addEventListener('click', () => {
      $('mf-mobile').value = '';
      $('mf-name').value = '';
      $('mf-lookup-hint').textContent = '';
      openSheet('member-form-sheet');
    });
    $('btn-save-member').addEventListener('click', () => saveMember().catch((e) => toast(e.message)));
    $('btn-copy-link').addEventListener('click', copyInviteLink);
    $('btn-share-link').addEventListener('click', shareInviteLink);

    $('ef-amount').addEventListener('input', () => {
      const raw = parseAmount($('ef-amount').value);
      $('ef-amount').value = raw ? String(raw) : '';
      $('ef-amount-fmt').textContent = fmt(raw) + ' تومان';
    });

    document.querySelectorAll('#expense-form-sheet .split-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        splitMode = btn.dataset.split;
        document.querySelectorAll('#expense-form-sheet .split-toggle button').forEach((b) => {
          b.classList.toggle('active', b.dataset.split === splitMode);
        });
        $('ef-custom-shares').classList.toggle('show', splitMode === 'custom');
      });
    });

    $('mf-mobile').addEventListener('input', () => {
      clearTimeout(lookupTimer);
      lookupTimer = setTimeout(lookupMobile, 400);
    });

    $('settle-create-tx').addEventListener('change', () => {
      const on = $('settle-create-tx').checked;
      $('settle-date-row').style.display = on ? 'block' : 'none';
      $('btn-settle-tx').style.display = on ? 'inline-flex' : 'none';
    });
    $('btn-settle-only').addEventListener('click', () => submitSettle(false).catch((e) => toast(e.message)));
    $('btn-settle-tx').addEventListener('click', () => submitSettle(true).catch((e) => toast(e.message)));

    document.querySelectorAll('[data-close-sheet]').forEach((btn) => {
      btn.addEventListener('click', () => closeSheet(btn.dataset.closeSheet));
    });
    $('sheet-overlay').addEventListener('click', () => {
      document.querySelectorAll('.dk-sheet.show').forEach((s) => closeSheet(s.id));
    });

    bindTabs();
  }

  async function init() {
    bindEvents();
    try {
      const profile = await api('/api/profile');
      myUserId = profile.id;
    } catch (_) { /* ok */ }

    await loadGroups();
    $('split-loading').style.display = 'none';
    $('view-list').style.display = 'block';

    const params = new URLSearchParams(location.search);
    const gid = params.get('id');
    if (gid) await loadGroupDetail(Number(gid));
  }

  init().catch((err) => {
    $('split-loading').textContent = err.message || 'خطا';
  });
})();
