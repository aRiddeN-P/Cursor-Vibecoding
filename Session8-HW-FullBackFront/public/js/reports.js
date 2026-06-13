(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => window.toPersianDigits(n);
  const fmt = (n) => pd(Number(n).toLocaleString('en'));
  const J = window.Jalali;
  const Charts = window.DakhlyarCharts;

  let tabRange = 1;
  let currentMonth = null;

  function getCurrentMonth() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function monthFa(month) {
    const [y, m] = month.split('-').map(Number);
    const j = J.toJalali(y, m, 1);
    return `${J.persianMonthName(j.jm)} ${pd(j.jy)}`;
  }

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

  function renderScore(scoreData) {
    Charts.drawScoreArc('score-arc', scoreData.score);
    const labelEl = $('score-label');
    labelEl.textContent = scoreData.label;
    labelEl.style.color = scoreData.color;

    $('score-breakdown').innerHTML = Object.values(scoreData.breakdown).map((c) => {
      const pct = c.max > 0 ? Math.round((c.score / c.max) * 100) : 0;
      return `<div class="rp-break-row">
        <span class="lbl">${c.label}</span>
        <div class="rp-break-bar"><i style="width:${pct}%"></i></div>
        <span class="val">${pd(c.score)}/${pd(c.max)}</span>
      </div>`;
    }).join('');

    $('score-tips').innerHTML = (scoreData.tips || []).map((t) => `<li>${t}</li>`).join('');
  }

  function renderSummary(monthly) {
    $('summary-title').textContent = 'خلاصه ' + monthFa(monthly.month);
    $('sum-income').textContent = fmt(monthly.income.total);
    $('sum-expense').textContent = fmt(monthly.expense.total);
    const bal = monthly.balance;
    $('sum-balance').textContent = (bal < 0 ? '−' : '') + fmt(Math.abs(bal));
  }

  function renderDonut(monthly) {
    const cats = monthly.expense.by_category;
    if (!cats.length) {
      $('donut-chart').innerHTML = '<p style="text-align:center;font-size:13px;color:var(--color-text-3);">داده‌ای نیست</p>';
      $('expense-legend').innerHTML = '';
      return;
    }
    Charts.drawDonut('donut-chart', cats.map((c) => ({
      label: c.category.name,
      value: c.amount,
      color: c.category.color || '#9CA3AF',
    })), fmt(monthly.expense.total) + ' ت');
    $('expense-legend').innerHTML = cats.map((c) => `
      <div class="rp-legend-item">
        <span class="dot" style="background:${c.category.color}"></span>
        <span class="name">${c.category.icon || ''} ${c.category.name}</span>
        <span class="pct-bar"><i style="width:${c.percentage}%;background:${c.category.color}"></i></span>
        <span class="amt">${fmt(c.amount)}</span>
      </div>`).join('');
  }

  function renderComparison(comp) {
    const labels = comp.comparison.map((c) => {
      const [y, m] = c.month.split('-').map(Number);
      const j = J.toJalali(y, m, 1);
      return J.persianMonthName(j.jm).slice(0, 3);
    });
    Charts.drawBars('comparison-chart', comp.comparison.map((c, i) => ({
      label: labels[i],
      income: c.income,
      expense: c.expense,
    })));
    const t = comp.trends;
    const sign = t.expense_change_percent >= 0 ? 'بیشتر' : 'کمتر';
    $('comparison-insight').textContent =
      `این ماه ${pd(Math.abs(t.expense_change_percent))}٪ ${sign} از ماه قبل خرج کردی`;
  }

  function renderWeekly(weekly) {
    Charts.drawWeekBars('weekly-chart', weekly.days);
    $('weekly-insight').textContent = weekly.peak_day_insight;
  }

  function renderForecast(forecast, monthly) {
    $('forecast-balance').textContent = fmt(forecast.projected_end_balance) + ' ت';
    const { days } = (function () {
      const [y, m] = currentMonth.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const elapsed = Math.min(last, new Date().getUTCDate());
      return { days: Math.round((elapsed / last) * 100) };
    })();
    $('forecast-progress').style.width = days + '%';
    const confMap = { low: 'اطمینان پایین', medium: 'اطمینان متوسط', high: 'اطمینان بالا' };
    $('forecast-confidence').textContent = confMap[forecast.confidence] || forecast.confidence;
    $('forecast-insight').textContent = forecast.insight;
  }

  function renderSubs(subs) {
    $('subs-alert').innerHTML = subs.alert
      ? `<div class="rp-alert-banner">${subs.alert}</div>` : '';
    $('subs-list').innerHTML = subs.subscriptions.length
      ? subs.subscriptions.map((s) => `
        <div class="rp-sub-item">
          <span>${s.title}</span>
          <span>${fmt(s.amount)} ت</span>
        </div>`).join('')
      : '<p style="text-align:center;font-size:13px;color:var(--color-text-3);">اشتراک ماهانه‌ای ثبت نشده</p>';
    $('subs-total').textContent = subs.count
      ? `مجموع ماهانه: ${fmt(subs.total_monthly)} تومان`
      : '';
  }

  async function loadAll() {
    currentMonth = getCurrentMonth();
    $('rp-loading').style.display = 'block';
    $('rp-content').style.display = 'none';

    const monthsParam = tabRange === 1 ? currentMonth : null;
    const compMonths = tabRange === 1 ? 3 : tabRange;

    const [score, monthly, comparison, weekly, forecast, subs] = await Promise.all([
      api('/api/reports/score?month=' + currentMonth),
      api('/api/reports/monthly?month=' + currentMonth),
      api('/api/reports/comparison?months=' + buildMonthList(compMonths).join(',')),
      api('/api/reports/weekly-pattern?months=' + Math.min(compMonths, 3)),
      api('/api/reports/cash-flow-forecast?month=' + currentMonth),
      api('/api/reports/subscription-tracker'),
    ]);

    renderScore(score);
    renderSummary(monthly);
    renderDonut(monthly);
    renderComparison(comparison);
    renderWeekly(weekly);
    renderForecast(forecast, monthly);
    renderSubs(subs);

    $('rp-loading').style.display = 'none';
    $('rp-content').style.display = 'block';
  }

  function buildMonthList(n) {
    const out = [];
    let cur = getCurrentMonth();
    for (let i = 0; i < n; i++) {
      out.unshift(cur);
      const [y, m] = cur.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 2, 1));
      cur = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    return out;
  }

  document.querySelectorAll('#rp-tabs .rp-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#rp-tabs .rp-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      tabRange = Number(tab.dataset.range) || 1;
      loadAll().catch(showErr);
    });
  });

  function showErr(err) {
    $('rp-loading').style.display = 'none';
    window.DakhlyarModal.alert({ subType: 'error', message: err.message || 'خطا در بارگذاری' });
  }

  $('btn-export-csv').addEventListener('click', () => {
    window.location.href = '/api/reports/export/csv?month=' + getCurrentMonth();
  });
  $('btn-export-pdf').addEventListener('click', () => {
    window.location.href = '/api/reports/export/pdf?month=' + getCurrentMonth();
  });

  $('btn-open-budget').addEventListener('click', () => {
    window.DakhlyarBudget.open(getCurrentMonth());
  });
  $('btn-budget-inline').addEventListener('click', () => {
    window.DakhlyarBudget.open(getCurrentMonth());
  });

  window.DakhlyarReports = { reload: () => loadAll().catch(showErr) };

  async function boot() {
    try {
      await loadAll();
    } catch (err) {
      showErr(err);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
