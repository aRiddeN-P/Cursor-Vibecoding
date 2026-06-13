(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => (window.toPersianDigits ? window.toPersianDigits(n) : String(n));
  const fmt = (n) => pd(Number(n || 0).toLocaleString('en'));

  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const memberMobile = params.get('member');

  async function fetchPublic(mobile) {
    let url = '/api/split/public/' + encodeURIComponent(token);
    if (mobile) url += '?mobile=' + encodeURIComponent(mobile);
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'خطا');
    return body;
  }

  function renderPersonal(data) {
    const p = data.personal;
    if (!p) {
      $('pv-mobile-step').style.display = 'block';
      return;
    }

    $('pv-mobile-step').style.display = 'none';
    $('pv-content').style.display = 'block';

    const bal = p.balance;
    const card = $('pv-balance-card');
    card.className = 'public-balance-card';
    if (bal > 0) {
      card.classList.add('owed');
      $('pv-balance-amount').textContent = fmt(bal) + ' تومان';
      $('pv-balance-label').textContent = 'طلبکار هستید';
    } else if (bal < 0) {
      card.classList.add('owes');
      $('pv-balance-amount').textContent = fmt(Math.abs(bal)) + ' تومان';
      $('pv-balance-label').textContent = 'بدهکار هستید';
    } else {
      card.classList.add('even');
      $('pv-balance-amount').textContent = '✓';
      $('pv-balance-label').textContent = 'حساب شما تسویه است';
    }

    const settleSec = $('pv-settle-section');
    const settleList = $('pv-settle-list');
    if (p.settlements_needed && p.settlements_needed.length) {
      settleSec.style.display = 'block';
      settleList.innerHTML = p.settlements_needed.map((s) =>
        `<p style="font-size:14px;margin:8px 0;">مبلغ ${fmt(s.amount)} تومان به <strong>${s.pay_to}</strong> پرداخت کنید</p>`
      ).join('');
    } else {
      settleSec.style.display = 'none';
    }

    const expEl = $('pv-expenses');
    if (!p.expenses || !p.expenses.length) {
      expEl.innerHTML = '<p style="font-size:13px;color:#9CA3AF;">هزینه‌ای یافت نشد</p>';
    } else {
      expEl.innerHTML = p.expenses.map((e) => {
        const dateStr = window.formatJalaliDate ? formatJalaliDate(e.expense_date) : e.expense_date;
        return `
          <div class="split-expense-row">
            <div class="split-expense-body">
              <div class="split-expense-title">${e.title}</div>
              <div class="split-expense-paid">${dateStr}</div>
              <div class="split-expense-share${e.is_settled ? ' settled' : ''}">
                سهم شما: ${fmt(e.my_share)}${e.is_settled ? ' ✓' : ''}
              </div>
            </div>
            <div class="split-expense-total">${fmt(e.amount)}</div>
          </div>`;
      }).join('');
    }
  }

  async function load(mobile) {
    const data = await fetchPublic(mobile);
    $('pv-group-name').textContent = data.group.name;
    $('pv-group-desc').textContent = data.group.description || `${pd(data.group.member_count)} عضو · ${fmt(data.group.total_expenses)} تومان`;
    renderPersonal(data);
  }

  async function init() {
    if (!token) {
      $('pv-loading').style.display = 'none';
      $('pv-error').style.display = 'block';
      $('pv-error').textContent = 'لینک نامعتبر است';
      return;
    }

    try {
      if (memberMobile) {
        await load(memberMobile);
      } else {
        const data = await fetchPublic(null);
        $('pv-group-name').textContent = data.group.name;
        $('pv-group-desc').textContent = data.group.description || '';
        $('pv-mobile-step').style.display = 'block';
      }
      $('pv-loading').style.display = 'none';
    } catch (err) {
      $('pv-loading').style.display = 'none';
      $('pv-error').style.display = 'block';
      $('pv-error').textContent = err.message || 'خطا';
    }
  }

  $('pv-submit-mobile').addEventListener('click', () => {
    const mobile = $('pv-mobile').value.trim();
    if (!mobile) return;
    $('pv-loading').style.display = 'block';
    $('pv-mobile-step').style.display = 'none';
    load(mobile).then(() => {
      $('pv-loading').style.display = 'none';
      history.replaceState(null, '', location.pathname + '?token=' + encodeURIComponent(token) + '&member=' + encodeURIComponent(mobile));
    }).catch((err) => {
      $('pv-loading').style.display = 'none';
      $('pv-mobile-step').style.display = 'block';
      alert(err.message);
    });
  });

  init();
})();
