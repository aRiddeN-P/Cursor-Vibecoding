(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => (window.toPersianDigits ? window.toPersianDigits(n) : String(n));
  const fmtMoney = (n) => pd(Number(n || 0).toLocaleString('en'));

  const HIDE_KEY = 'dakhlyar_dash_hide_value';
  let hideValues = sessionStorage.getItem(HIDE_KEY) === '1';
  let insightsPool = [];
  let insightIndex = 0;
  let marketTimer = null;

  const TICKER_SYMBOLS = [
    { sym: 'IR_GOLD_18K', name: 'طلای ۱۸ عیار', cat: 'gold_currency' },
    { sym: 'USD', name: 'دلار', cat: 'gold_currency' },
    { sym: 'IR_COIN_EMAMI', name: 'سکه امامی', cat: 'gold_currency' },
    { sym: 'BTC', name: 'بیتکوین', cat: 'crypto' },
  ];

  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts));
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { status: res.status, ok: res.ok, data: data || {} };
  }

  function masked(val) {
    return hideValues ? '••••••••' : val;
  }

  function drawSmallScoreArc(containerId, score) {
    const wrap = $(containerId);
    if (!wrap) return;
    const size = 68;
    const cx = size / 2;
    const cy = size / 2;
    const r = 28;
    const circ = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, Number(score) || 0));
    const dash = (pct / 100) * circ;
    const color = pct >= 80 ? '#1A5C3A' : pct >= 60 ? '#3B82F6' : pct >= 40 ? '#F59E0B' : '#DC2626';
    wrap.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="6"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="6"
          stroke-dasharray="${dash} ${circ}" stroke-linecap="round"
          transform="rotate(-90 ${cx} ${cy})"/>
      </svg>`;
  }

  function drawMiniComparisonChart(svgId, months) {
    const svg = $(svgId);
    if (!svg || !months || !months.length) return;
    const w = 300;
    const h = 72;
    const pad = 8;
    const barW = Math.floor((w - pad * 2) / months.length / 2.5);
    const maxVal = Math.max(...months.flatMap((m) => [m.income || 0, m.expense || 0]), 1);
    let html = '';
    months.forEach((m, i) => {
      const gx = pad + i * (barW * 2.8);
      const incH = ((m.income || 0) / maxVal) * (h - 20);
      const expH = ((m.expense || 0) / maxVal) * (h - 20);
      const baseY = h - 4;
      html += `<rect x="${gx}" y="${baseY - incH}" width="${barW}" height="${incH}" fill="#1A5C3A" rx="2"/>`;
      html += `<rect x="${gx + barW + 3}" y="${baseY - expH}" width="${barW}" height="${expH}" fill="#DC2626" rx="2"/>`;
    });
    svg.innerHTML = html;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  function renderTxItem(tx) {
    const isInc = tx.type === 'income';
    const sign = isInc ? '+' : '−';
    const cls = isInc ? 'income' : 'expense';
    const icon = tx.category_icon || (isInc ? '💰' : '💸');
    const color = tx.category_color || '#6B7280';
    const dateStr = window.formatJalaliDate
      ? formatJalaliDate(tx.transaction_date)
      : pd(String(tx.transaction_date || '').slice(5));
    return `
      <article class="tx-item" onclick="location.href='/transactions.html'">
        <div class="tx-cat-icon" style="background:${color}20">${icon}</div>
        <div class="tx-body">
          <div class="tx-title-row">${tx.title || '—'}</div>
          <div class="tx-meta-row">${tx.category_name || ''} · ${dateStr}</div>
        </div>
        <div class="tx-amount ${cls}">${sign}${fmtMoney(tx.amount)}</div>
      </article>`;
  }

  function findMarketPrice(marketData, spec) {
    if (!marketData) return null;
    const bucket = marketData[spec.cat];
    if (!bucket || !bucket.items) return null;
    if (spec.cat === 'crypto') {
      return bucket.items.find((i) => {
        const sym = String(i.symbol || '').toUpperCase();
        const name = String(i.name || '').toUpperCase();
        return sym === spec.sym || name.includes(spec.sym);
      });
    }
    return bucket.items.find((i) => i.symbol === spec.sym);
  }

  function renderMarketTicker(marketData) {
    const el = $('market-ticker');
    if (!el) return;
    if (!marketData) {
      el.innerHTML = '<p class="dash-muted">داده در دسترس نیست</p>';
      return;
    }
    let html = '';
    for (const spec of TICKER_SYMBOLS) {
      const item = findMarketPrice(marketData, spec);
      if (!item) continue;
      const price = spec.cat === 'crypto' ? item.price_toman : item.price;
      const ch = Number(item.change_percent || 0);
      const chCls = ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat';
      const chSign = ch > 0 ? '+' : ch < 0 ? '−' : '';
      html += `
        <div class="ticker-card" onclick="location.href='/market.html'">
          <div class="ticker-name">${spec.name}</div>
          <div class="ticker-price">${fmtMoney(price)}</div>
          <span class="ticker-change ${chCls}">${chSign}${pd(Math.abs(ch).toFixed(1))}٪</span>
        </div>`;
    }
    el.innerHTML = html || '<p class="dash-muted">داده در دسترس نیست</p>';
  }

  function renderInsight(forceNext) {
    if (!insightsPool.length) {
      $('insight-text').textContent = 'هنوز بینشی برای نمایش وجود ندارد';
      return;
    }
    if (forceNext) insightIndex = (insightIndex + 1) % insightsPool.length;
    else insightIndex = Math.floor(Math.random() * insightsPool.length);
    $('insight-text').textContent = insightsPool[insightIndex].message || '—';
  }

  function renderHero(netWorth, monthly, hasSub) {
    const label = $('hero-label');
    const note = $('hero-note');
    let value = 0;
    let changeHtml = '';

    if (hasSub && netWorth && netWorth.net_worth != null) {
      value = netWorth.net_worth;
      label.textContent = 'ارزش حدودی کل دارایی';
      note.style.display = 'none';
    } else if (monthly) {
      value = monthly.balance || 0;
      label.textContent = 'مانده این ماه';
      note.style.display = 'block';
      note.textContent = 'برای مشاهده ارزش دارایی‌ها اشتراک تهیه کنید';
    }

    $('hero-value').textContent = masked(fmtMoney(value));

    if (monthly && monthly.balance != null) {
      const prevBal = monthly._prevBalance;
      if (prevBal != null && prevBal !== 0) {
        const pct = Math.round(((monthly.balance - prevBal) / Math.abs(prevBal)) * 100);
        const cls = pct >= 0 ? 'up' : 'down';
        const sign = pct >= 0 ? '+' : '−';
        changeHtml = `${sign}${pd(Math.abs(pct))}٪ نسبت به ماه قبل`;
        $('hero-change').className = 'dash-hero-change ' + cls;
      }
    }
    $('hero-change').textContent = changeHtml;
  }

  function renderSummary(monthly, comparison) {
    const card = $('summary-card');
    if (!monthly) {
      card.innerHTML = '<p class="dash-muted">داده در دسترس نیست</p>';
      return;
    }
    const months = comparison && comparison.comparison ? comparison.comparison.slice(-3) : [];
    card.innerHTML = `
      <div class="dash-summary-row">
        <div class="dash-summary-item">
          <div class="lbl">درآمد</div>
          <div class="val income">${masked(fmtMoney(monthly.income?.total))}</div>
        </div>
        <div class="dash-summary-item">
          <div class="lbl">هزینه</div>
          <div class="val expense">${masked(fmtMoney(monthly.expense?.total))}</div>
        </div>
        <div class="dash-summary-item">
          <div class="lbl">مانده</div>
          <div class="val">${masked(fmtMoney(monthly.balance))}</div>
        </div>
      </div>
      <svg class="dash-mini-chart" id="dash-mini-chart"></svg>`;
    if (months.length) drawMiniComparisonChart('dash-mini-chart', months);
  }

  function renderScoreWidget(scoreData, scoreHistory) {
    const card = $('score-card');
    if (!scoreData) {
      card.innerHTML = '<p class="dash-muted">داده در دسترس نیست</p>';
      return;
    }
    let trend = '';
    if (scoreHistory && scoreHistory.history && scoreHistory.history.length >= 2) {
      const h = scoreHistory.history;
      const diff = h[h.length - 1].score - h[h.length - 2].score;
      if (diff !== 0) {
        const sign = diff > 0 ? '+' : '−';
        trend = `نسبت به ماه قبل: ${sign}${pd(Math.abs(diff))} امتیاز`;
      }
    }
    card.innerHTML = `
      <div class="dash-score-arc-wrap" id="dash-score-arc"></div>
      <div class="dash-score-info">
        <div class="score-num">${pd(scoreData.score)}</div>
        <div class="score-label">${scoreData.label || '—'}</div>
        <div class="score-trend">${trend || 'امتیاز ماه جاری'}</div>
      </div>`;
    drawSmallScoreArc('dash-score-arc', scoreData.score);
  }

  function renderGoals(goalsData) {
    const sec = $('sec-goals');
    const list = $('goals-list');
    if (!goalsData || !goalsData.goals) {
      sec.style.display = 'none';
      return;
    }
    const active = goalsData.goals.filter((g) => !g.is_completed).slice(0, 3);
    if (!active.length) {
      sec.style.display = 'none';
      return;
    }
    sec.style.display = 'block';
    list.innerHTML = active.map((g) => {
      const pct = g.percentage || 0;
      return `
        <div class="dash-goal-row">
          <div class="dash-goal-top">
            <span>${g.icon || '🎯'} ${g.title}</span>
            <span>${pd(pct)}٪</span>
          </div>
          <div class="dash-goal-bar"><div class="dash-goal-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
  }

  function renderTransactions(txData) {
    const list = $('tx-list');
    if (!txData || !txData.transactions || !txData.transactions.length) {
      list.innerHTML = '<p class="dash-muted">تراکنشی ثبت نشده</p>';
      return;
    }
    list.innerHTML = txData.transactions.map(renderTxItem).join('');
  }

  async function loadProfileAvatar() {
    try {
      const r = await fetchJson('/api/profile');
      if (!r.ok) return;
      const me = r.data.user || r.data;
      const url = me.avatar_url || (window.getAvatarUrl ? window.getAvatarUrl(me) : '');
      if (url && $('dash-avatar')) $('dash-avatar').src = url;
    } catch (_) { /* silent */ }
  }

  async function loadDashboard() {
    const month = new Date().toISOString().slice(0, 7);
    const results = await Promise.allSettled([
      fetchJson('/api/reports/monthly?month=' + month),
      fetchJson('/api/reports/comparison?months=' + month),
      fetchJson('/api/reports/score?month=' + month),
      fetchJson('/api/reports/score/history?months=6'),
      fetchJson('/api/market/all'),
      fetchJson('/api/transactions?limit=5&page=1&month=' + month),
      fetchJson('/api/goals'),
      fetchJson('/api/reports/insights?months=3'),
      fetchJson('/api/assets/net-worth'),
      fetchJson('/api/banners/active'),
    ]);

    const get = (i) => (results[i].status === 'fulfilled' ? results[i].value : null);

    const monthlyR = get(0);
    const comparisonR = get(1);
    const scoreR = get(2);
    const scoreHistR = get(3);
    const marketR = get(4);
    const txR = get(5);
    const goalsR = get(6);
    const insightsR = get(7);
    const netWorthR = get(8);
    const bannerR = get(9);

    const monthly = monthlyR && monthlyR.ok ? monthlyR.data : null;
    const comparison = comparisonR && comparisonR.ok ? comparisonR.data : null;
    if (monthly && comparison && comparison.comparison && comparison.comparison.length >= 2) {
      const prev = comparison.comparison[comparison.comparison.length - 2];
      monthly._prevBalance = prev.balance;
    }

    const hasSub = netWorthR && netWorthR.ok;
    const netWorth = hasSub ? netWorthR.data : null;

    renderHero(netWorth, monthly, hasSub);
    renderSummary(monthly, comparison);
    renderScoreWidget(
      scoreR && scoreR.ok ? scoreR.data : null,
      scoreHistR && scoreHistR.ok ? scoreHistR.data : null
    );

    const marketData = marketR && marketR.ok ? marketR.data : null;
    renderMarketTicker(marketData);
    if (marketTimer) clearInterval(marketTimer);
    marketTimer = setInterval(async () => {
      const m = await fetchJson('/api/market/all');
      if (m.ok) renderMarketTicker(m.data);
    }, 5 * 60 * 1000);

    renderTransactions(txR && txR.ok ? txR.data : null);
    renderGoals(goalsR && goalsR.ok ? goalsR.data : null);

    if (insightsR && insightsR.ok && insightsR.data.insights) {
      insightsPool = insightsR.data.insights;
      renderInsight(false);
    } else {
      $('insight-text').textContent = 'داده در دسترس نیست';
    }

    if (window._dashBanner) window._dashBanner.destroy();
    if (bannerR && bannerR.ok && bannerR.data && bannerR.data.banners &&
        bannerR.data.banners.length) {
      window._dashBanner = new window.DakhlyarBanner(bannerR.data.banners, 'dash-banner');
      window._dashBanner.render();
    }
  }

  async function maybeShowStories() {
    try {
      const statusRes = await fetchJson('/api/stories/status');
      if (statusRes.status === 401) {
        location.href = '/';
        return;
      }
      if (!statusRes.ok || statusRes.data.has_seen_stories === 1) return;
      const listRes = await fetchJson('/api/stories');
      if (!listRes.ok) return;
      const stories = listRes.data.stories || [];
      if (!stories.length || typeof window.StoryPlayer !== 'function') return;
      new window.StoryPlayer(stories).open();
    } catch (_) { /* silent */ }
  }

  function init() {
    $('btn-profile').addEventListener('click', () => { location.href = '/profile.html'; });
    $('btn-hero-eye').addEventListener('click', () => {
      hideValues = !hideValues;
      sessionStorage.setItem(HIDE_KEY, hideValues ? '1' : '0');
      loadDashboard();
    });
    $('act-add-tx').addEventListener('click', () => {
      location.href = '/transactions.html?add=1';
    });
    $('btn-insight-refresh').addEventListener('click', () => renderInsight(true));

    loadProfileAvatar();
    loadDashboard();
    maybeShowStories();
    if (window.updateMessageBadge) updateMessageBadge();
    if (window.DakhlyarNav) DakhlyarNav.init('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
