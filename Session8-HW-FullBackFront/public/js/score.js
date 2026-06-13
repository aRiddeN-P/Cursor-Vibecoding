(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => (window.toPersianDigits ? window.toPersianDigits(n) : String(n));

  const INSIGHT_ICONS = {
    peak_day: '📅',
    category_trend: '📊',
    savings_rate: '💰',
    subscriptions: '📱',
    budget_adherence: '🎯',
    logging_streak: '🔥',
  };

  const MONTH_FA = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

  async function api(path) {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (res.status === 401) {
      window.location.href = '/';
      throw new Error('unauthorized');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'خطا');
    return body;
  }

  function monthLabel(ym) {
    const parts = String(ym).split('-');
    if (parts.length < 2) return ym;
    const m = Number(parts[1]);
    if (window.formatJalaliDate) {
      return formatJalaliDate(ym + '-01').slice(0, 7);
    }
    return MONTH_FA[m] || ym;
  }

  function drawLargeArc(score, color) {
    const svg = $('score-arc-lg');
    if (!svg) return;
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const r = 82;
    const circ = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, Number(score) || 0));
    const dash = (pct / 100) * circ;
    const stroke = color || (pct >= 80 ? '#1A5C3A' : pct >= 60 ? '#3B82F6' : pct >= 40 ? '#F59E0B' : '#DC2626');
    svg.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="14"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="14"
        stroke-dasharray="${dash} ${circ}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})">
        <animate attributeName="stroke-dasharray" from="0 ${circ}" to="${dash} ${circ}" dur="0.9s" fill="freeze"/>
      </circle>`;
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  }

  function drawHistoryChart(history) {
    const svg = $('score-history-chart');
    if (!svg || !history.length) return;
    const w = 320;
    const h = 140;
    const pad = 24;
    const maxScore = 100;
    const barW = Math.floor((w - pad * 2) / history.length) - 8;
    let bars = '';
    let linePoints = [];

    history.forEach((item, i) => {
      const x = pad + i * (barW + 8);
      const barH = (item.score / maxScore) * (h - 40);
      const y = h - 28 - barH;
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="#1A5C3A" opacity="0.85" rx="4">
        <animate attributeName="height" from="0" to="${barH}" dur="0.6s" fill="freeze"/>
        <animate attributeName="y" from="${h - 28}" to="${y}" dur="0.6s" fill="freeze"/>
      </rect>`;
      bars += `<text x="${x + barW / 2}" y="${h - 8}" text-anchor="middle" font-size="9" fill="#9CA3AF" font-family="Vazirmatn">${monthLabel(item.month).slice(-5)}</text>`;
      bars += `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#0D2E1E" font-family="Vazirmatn">${pd(item.score)}</text>`;
      linePoints.push(`${x + barW / 2},${y}`);
    });

    const polyline = linePoints.length > 1
      ? `<polyline points="${linePoints.join(' ')}" fill="none" stroke="#F0B429" stroke-width="2" stroke-linecap="round" opacity="0.9"/>`
      : '';

    svg.innerHTML = bars + polyline;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  function renderBreakdown(breakdown) {
    const el = $('score-breakdown');
    if (!breakdown) {
      el.innerHTML = '<p class="dash-muted">—</p>';
      return;
    }
    el.innerHTML = Object.values(breakdown).map((comp) => {
      const pct = comp.max > 0 ? Math.round((comp.score / comp.max) * 100) : 0;
      const note = comp.detail || comp.active_days != null
        ? (comp.detail || `${pd(comp.active_days)} روز فعال`)
        : comp.assignment_percent != null
          ? `${pd(comp.assignment_percent)}٪ تخصیص`
          : '';
      return `
        <div class="score-component-card">
          <div class="score-component-header">
            <span class="score-component-name">${comp.label}</span>
            <span class="score-component-pts">${pd(comp.score)}/${pd(comp.max)}</span>
          </div>
          <div class="score-component-bar-wrap">
            <div class="score-component-bar-fill" style="width:${pct}%"></div>
          </div>
          ${note ? `<div class="score-component-note">${note}</div>` : ''}
        </div>`;
    }).join('');
  }

  function renderInsights(insights) {
    const el = $('insights-list');
    if (!insights || !insights.length) {
      el.innerHTML = '<p class="dash-muted">بینشی یافت نشد</p>';
      return;
    }
    el.innerHTML = insights.map((ins) => {
      const dir = ins.direction || 'neutral';
      const icon = INSIGHT_ICONS[ins.type] || '💡';
      return `
        <div class="insight-card ${dir}">
          <span class="insight-icon">${icon}</span>
          <p class="insight-text">${ins.message}</p>
        </div>`;
    }).join('');
  }

  function renderTips(tips) {
    const el = $('tips-list');
    if (!tips || !tips.length) {
      el.innerHTML = '<p class="dash-muted">—</p>';
      return;
    }
    el.innerHTML = tips.map((t) => `<div class="tip-item">${t}</div>`).join('');
  }

  async function loadAll() {
    const month = new Date().toISOString().slice(0, 7);
    const [score, history, insights] = await Promise.all([
      api('/api/reports/score?month=' + month),
      api('/api/reports/score/history?months=6'),
      api('/api/reports/insights?months=3'),
    ]);

    $('score-loading').style.display = 'none';
    $('score-app').style.display = 'block';

    $('score-num').textContent = pd(score.score);
    $('score-label').textContent = score.label || '—';
    drawLargeArc(score.score, score.color);

    drawHistoryChart(history.history || []);
    if (history.best_month) {
      $('score-best-month').textContent =
        `بهترین ماه: ${monthLabel(history.best_month.month)} — ${pd(history.best_month.score)} امتیاز`;
    }

    renderBreakdown(score.breakdown);
    renderInsights(insights.insights);
    renderTips(score.tips);
  }

  loadAll().catch((err) => {
    $('score-loading').textContent = err.message || 'خطا در بارگذاری';
  });
})();
