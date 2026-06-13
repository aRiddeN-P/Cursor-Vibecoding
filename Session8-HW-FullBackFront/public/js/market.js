(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => window.toPersianDigits(n);
  const fmtNum = (n, dec) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return pd('0');
    const fixed = dec != null ? num.toFixed(dec) : String(Math.round(num));
    return pd(Number(fixed).toLocaleString('en', {
      minimumFractionDigits: dec != null ? dec : 0,
      maximumFractionDigits: dec != null ? dec : 0,
    }));
  };

  let activeTab = 'gold';
  let searchQuery = '';
  let cryptoSort = 'default';
  let marketData = {
    gold_currency: { items: [], cache_age_minutes: 0, stale: false },
    crypto: { items: [], cache_age_minutes: 0, stale: false },
    commodity: { items: [], cache_age_minutes: 0, stale: false },
    errors: [],
  };
  let favorites = [];
  let detailItem = null;
  let refreshTimer = null;
  let cacheAgeTimer = null;
  let vpnBlocked = false;

  function setVpnBlocked(blocked) {
    vpnBlocked = blocked;
    const block = $('market-vpn-block');
    const tabs = $('market-tabs');
    const search = document.querySelector('.market-search');
    const toolbar = $('crypto-toolbar');
    if (block) block.style.display = blocked ? 'block' : 'none';
    if (tabs) tabs.style.display = blocked ? 'none' : 'flex';
    if (search) search.style.display = blocked ? 'none' : 'block';
    if (toolbar && blocked) toolbar.style.display = 'none';
    $('market-grid').style.display = blocked ? 'none' : 'grid';
    $('market-loading').style.display = blocked ? 'none' : $('market-loading').style.display;
    if (blocked) {
      $('cache-age').textContent = '';
      $('market-error').style.display = 'none';
    }
  }

  async function checkVpn(showModal) {
    const V = window.DakhlyarVpnDetect;
    if (!V || typeof V.detect !== 'function') return true;

    let loadingToken = null;
    try {
      if (showModal && window.DakhlyarModal?.loading) {
        loadingToken = window.DakhlyarModal.loading({ message: V.COPY.checking });
      }
      const result = await V.detect();
      if (loadingToken && window.DakhlyarModal?.closeLoading) {
        window.DakhlyarModal.closeLoading(loadingToken);
        loadingToken = null;
      }
      if (result && result.isVPN) {
        setVpnBlocked(true);
        if (showModal && window.DakhlyarModal?.alert) {
          window.DakhlyarModal.alert({
            title: V.COPY.title,
            message: V.COPY.marketMessage,
            subType: 'error',
            confirmText: 'متوجه شدم',
          });
        }
        return false;
      }
      setVpnBlocked(false);
      return true;
    } catch (_) {
      if (loadingToken && window.DakhlyarModal?.closeLoading) {
        window.DakhlyarModal.closeLoading(loadingToken);
      }
      return true;
    }
  }

  function isFavorite(symbol, category) {
    return favorites.some((f) => f.symbol === symbol && f.category === category);
  }

  function isPinned(symbol, category) {
    const f = favorites.find((x) => x.symbol === symbol && x.category === category);
    return f && f.is_pinned;
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

  function showToast(msg, ms = 2200) {
    const el = $('market-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
  }

  function maxCacheAge() {
    const ages = [
      marketData.gold_currency?.cache_age_minutes,
      marketData.crypto?.cache_age_minutes,
      marketData.commodity?.cache_age_minutes,
    ].filter((a) => typeof a === 'number');
    return ages.length ? Math.max(...ages) : 0;
  }

  function updateCacheAgeLabel() {
    const el = $('cache-age');
    const age = maxCacheAge();
    const stale = marketData.gold_currency?.stale || marketData.crypto?.stale || marketData.commodity?.stale;
    el.textContent = age === 0
      ? 'آخرین بروزرسانی: همین الان'
      : `آخرین بروزرسانی: ${pd(age)} دقیقه پیش`;
    el.classList.toggle('stale', !!stale);
  }

  function changeBadge(change, changeValue) {
    const c = Number(change);
    let cls = 'flat';
    let prefix = '—';
    if (c > 0) { cls = 'up'; prefix = '▲'; }
    else if (c < 0) { cls = 'down'; prefix = '▼'; }
    const pct = fmtNum(Math.abs(c), 2) + '٪';
    let valStr = '';
    if (changeValue != null && changeValue !== 0) {
      valStr = '  ' + (c >= 0 ? '+' : '−') + fmtNum(Math.abs(changeValue));
    }
    return `<span class="market-card-change ${cls}">${prefix} ${pct}${valStr}</span>`;
  }

  const MARKET_ICONS = {
    coin: '/img/market/coin-bahar-azadi.png',
    gold: '/img/market/gold-bar.png',
    silver: '/img/market/silver-bar.png',
  };

  function isSilverItem(item) {
    const sym = String(item.symbol || '').toUpperCase();
    const name = String(item.name || '');
    return /XAG|SILVER/.test(sym) || /نقره/.test(name);
  }

  function isGoldItem(item, category) {
    if (isSilverItem(item)) return false;
    if (category === 'gold_currency' && item.group === 'gold') return true;
    const sym = String(item.symbol || '').toUpperCase();
    const name = String(item.name || '');
    return /XAU|GOLD/.test(sym) || (/طلا/.test(name) && !/نقره/.test(name));
  }

  function marketIconKind(item, category) {
    if (category === 'gold_currency' && item.group === 'coin') return 'coin';
    if (isSilverItem(item)) return 'silver';
    if (isGoldItem(item, category)) return 'gold';
    return null;
  }

  function marketIconHtml(item, category) {
    const kind = marketIconKind(item, category);
    if (kind && MARKET_ICONS[kind]) {
      const cls = kind === 'coin' ? 'market-icon-img is-coin' : 'market-icon-img';
      return `<img src="${MARKET_ICONS[kind]}" alt="" loading="lazy" class="${cls}">`;
    }
    if (category === 'gold_currency') return '💵';
    return '⚙️';
  }

  function filterItems(items, fields) {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((it) =>
      fields.some((f) => String(it[f] || '').toLowerCase().includes(q))
    );
  }

  function sortCrypto(items) {
    const list = items.slice();
    if (cryptoSort === 'change_desc') list.sort((a, b) => b.change_percent - a.change_percent);
    else if (cryptoSort === 'change_asc') list.sort((a, b) => a.change_percent - b.change_percent);
    else if (cryptoSort === 'mcap') list.sort((a, b) => b.market_cap - a.market_cap);
    return list;
  }

  function renderCard(item, category) {
    const fav = isFavorite(item.symbol, category);
    const pinned = isPinned(item.symbol, category);
    const star = fav ? '⭐' : '☆';
    const pinHtml = pinned ? '<span class="pin-badge">📌</span>' : '';

    if (category === 'crypto') {
      const icon = item.icon_url
        ? `<img src="${item.icon_url}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : '₿';
      return `<article class="market-card${pinned ? ' pinned' : ''}" data-symbol="${item.symbol}" data-cat="${category}">
        <button type="button" class="market-card-star" data-star="${item.symbol}" data-cat="${category}" aria-label="علاقه‌مندی">${star}</button>
        ${pinHtml}
        <span class="market-card-icon">${icon}</span>
        <div class="market-card-name">${item.name}</div>
        <div class="market-card-price">${fmtNum(item.price_toman)} تومان</div>
        <div class="market-card-price-usd">$${fmtNum(item.price_usd, 2)}</div>
        ${changeBadge(item.change_percent)}
        <div class="market-card-mcap">مارکت‌کپ: $${fmtNum(item.market_cap)}</div>
        <div class="market-card-time">${item.updated_at || ''}</div>
      </article>`;
    }

    const icon = marketIconHtml(item, category);
    return `<article class="market-card${pinned ? ' pinned' : ''}" data-symbol="${item.symbol}" data-cat="${category}">
      <button type="button" class="market-card-star" data-star="${item.symbol}" data-cat="${category}" aria-label="علاقه‌مندی">${star}</button>
      ${pinHtml}
      <span class="market-card-icon">${icon}</span>
      <div class="market-card-name">${item.name}</div>
      <div class="market-card-price">${fmtNum(item.price)} ${item.unit || ''}</div>
      ${changeBadge(item.change_percent, item.change_value)}
      <div class="market-card-time">${item.updated_at || ''}</div>
    </article>`;
  }

  function sectionTitle(text) {
    return `<div class="market-section-title">${text}</div>`;
  }

  function renderGoldGrid() {
    let items = filterItems(marketData.gold_currency.items || [], ['name', 'name_en', 'symbol']);
    const goldCoin = items.filter((i) => i.group === 'gold' || i.group === 'coin');
    const currency = items.filter((i) => i.group === 'currency');
    let html = '';
    if (goldCoin.length) {
      html += sectionTitle('طلا و سکه');
      html += goldCoin.map((i) => renderCard(i, 'gold_currency')).join('');
    }
    if (currency.length) {
      html += sectionTitle('ارز خارجی');
      html += currency.map((i) => renderCard(i, 'gold_currency')).join('');
    }
    return html || '<div class="favorites-empty">نتیجه‌ای یافت نشد</div>';
  }

  function renderCommodityGrid() {
    let items = filterItems(marketData.commodity.items || [], ['name', 'symbol']);
    const precious = items.filter((i) => i.section === 'precious');
    const base = items.filter((i) => i.section === 'base');
    const energy = items.filter((i) => i.section === 'energy');
    let html = '';
    if (precious.length) {
      html += sectionTitle('فلزات گرانبها');
      html += precious.map((i) => renderCard(i, 'commodity')).join('');
    }
    if (base.length) {
      html += sectionTitle('فلزات اساسی');
      html += base.map((i) => renderCard(i, 'commodity')).join('');
    }
    if (energy.length) {
      html += sectionTitle('انرژی');
      html += energy.map((i) => renderCard(i, 'commodity')).join('');
    }
    return html || '<div class="favorites-empty">نتیجه‌ای یافت نشد</div>';
  }

  function renderCryptoGrid() {
    let items = sortCrypto(filterItems(marketData.crypto.items || [], ['name', 'symbol']));
    if (!items.length) return '<div class="favorites-empty">نتیجه‌ای یافت نشد</div>';
    return items.map((i) => renderCard(i, 'crypto')).join('');
  }

  function findItem(symbol, category) {
    const bucket = marketData[category];
    if (!bucket || !bucket.items) return null;
    return bucket.items.find((i) => i.symbol === symbol) || null;
  }

  function renderFavoritesGrid() {
    if (!favorites.length) {
      return '<div class="favorites-empty">هنوز آیتمی به علاقه‌مندی‌ها اضافه نشده — روی ⭐ هر آیتم بزنید</div>';
    }
    const pinned = favorites.filter((f) => f.is_pinned);
    const rest = favorites.filter((f) => !f.is_pinned);
    let html = '';
    const renderFav = (f) => {
      const item = findItem(f.symbol, f.category);
      if (!item) return '';
      if (searchQuery) {
        const name = item.name || '';
        if (!name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !f.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return '';
      }
      return renderCard(item, f.category);
    };
    if (pinned.length) {
      html += sectionTitle('پین‌شده');
      html += pinned.map(renderFav).join('');
    }
    if (rest.length) {
      html += sectionTitle('سایر علاقه‌مندی‌ها');
      html += rest.map(renderFav).join('');
    }
    return html || '<div class="favorites-empty">نتیجه‌ای یافت نشد</div>';
  }

  function renderGrid() {
    $('crypto-toolbar').style.display = activeTab === 'crypto' ? 'flex' : 'none';
    let html = '';
    if (activeTab === 'gold') html = renderGoldGrid();
    else if (activeTab === 'crypto') html = renderCryptoGrid();
    else if (activeTab === 'commodity') html = renderCommodityGrid();
    else html = renderFavoritesGrid();

    $('market-grid').innerHTML = html;
    $('market-grid').style.display = 'grid';
    $('market-loading').style.display = 'none';
    updateCacheAgeLabel();
  }

  async function loadFavorites() {
    const data = await api('/api/market/favorites');
    favorites = data.favorites || [];
  }

  async function loadMarket(force) {
    if (vpnBlocked) return;

    const q = force ? '?force=true' : '';
    const icon = $('refresh-icon');
    if (icon) icon.classList.add('spinning');
    try {
      const all = await api('/api/market/all' + q);
      await loadFavorites();
      marketData = {
        gold_currency: all.gold_currency || { items: [] },
        crypto: all.crypto || { items: [] },
        commodity: all.commodity || { items: [] },
        errors: all.errors || [],
      };
      const errEl = $('market-error');
      if (marketData.errors.length) {
        errEl.style.display = 'block';
        errEl.textContent = 'برخی منابع قیمت در دسترس نیستند — دادهٔ ذخیره‌شده نمایش داده می‌شود.';
      } else {
        errEl.style.display = 'none';
      }
      renderGrid();
      if (force) showToast('بروزرسانی شد ✓');
    } catch (err) {
      $('market-loading').textContent = err.message || 'خطا در دریافت قیمت‌ها';
      window.DakhlyarModal?.alert({ title: 'خطا', message: err.message, subType: 'danger' });
    } finally {
      if (icon) icon.classList.remove('spinning');
    }
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
    detailItem = null;
  }

  function shareText(item, category) {
    if (category === 'crypto') {
      const sign = item.change_percent >= 0 ? '+' : '−';
      return `${item.name}: ${fmtNum(item.price_toman)} تومان (${sign}${fmtNum(Math.abs(item.change_percent), 2)}٪) | دخلیار`;
    }
    const sign = item.change_percent >= 0 ? '+' : '−';
    return `${item.name}: ${fmtNum(item.price)} ${item.unit || 'تومان'} (${sign}${fmtNum(Math.abs(item.change_percent), 2)}٪) | دخلیار`;
  }

  function openDetail(symbol, category) {
    const item = findItem(symbol, category);
    if (!item) return;
    detailItem = { item, category };
    $('detail-title').textContent = item.name;
    const pinned = isPinned(symbol, category);
    let rows = '';
    if (category === 'crypto') {
      rows = `
        <div class="market-detail-row"><span class="lbl">قیمت (تومان)</span><span class="val">${fmtNum(item.price_toman)}</span></div>
        <div class="market-detail-row"><span class="lbl">قیمت (دلار)</span><span class="val">$${fmtNum(item.price_usd, 2)}</span></div>
        <div class="market-detail-row"><span class="lbl">تغییر</span><span class="val">${fmtNum(item.change_percent, 2)}٪</span></div>
        <div class="market-detail-row"><span class="lbl">مارکت‌کپ</span><span class="val">$${fmtNum(item.market_cap)}</span></div>`;
    } else {
      rows = `
        <div class="market-detail-row"><span class="lbl">قیمت</span><span class="val">${fmtNum(item.price)} ${item.unit || ''}</span></div>
        <div class="market-detail-row"><span class="lbl">تغییر</span><span class="val">${fmtNum(item.change_percent, 2)}٪</span></div>
        <div class="market-detail-row"><span class="lbl">مقدار تغییر</span><span class="val">${fmtNum(item.change_value)}</span></div>`;
    }
    rows += `<div class="market-detail-row"><span class="lbl">بروزرسانی</span><span class="val">${item.updated_at || '—'}</span></div>`;

    $('detail-body').innerHTML = rows + `
      <p class="market-detail-note">قیمت‌های تاریخی در نسخه آینده</p>
      <div class="market-detail-actions">
        <button type="button" id="detail-pin">${pinned ? '📌 آنپین' : '📌 پین'}</button>
        <button type="button" class="primary" id="detail-fav">${isFavorite(symbol, category) ? '☆ حذف از علاقه‌مندی' : '⭐ افزودن به علاقه‌مندی'}</button>
      </div>`;

    $('detail-pin').onclick = () => togglePin(symbol, category, !pinned);
    $('detail-fav').onclick = () => toggleFavorite(symbol, category).then(() => openDetail(symbol, category));
    openSheet('detail-sheet');
  }

  async function toggleFavorite(symbol, category) {
    if (isFavorite(symbol, category)) {
      await api(`/api/market/favorites/${encodeURIComponent(symbol)}?category=${category}`, { method: 'DELETE' });
    } else {
      await api('/api/market/favorites', { method: 'POST', body: { symbol, category } });
    }
    await loadFavorites();
    renderGrid();
  }

  async function togglePin(symbol, category, pinned) {
    if (!isFavorite(symbol, category)) {
      await api('/api/market/favorites', { method: 'POST', body: { symbol, category } });
    }
    await api(`/api/market/favorites/${encodeURIComponent(symbol)}/pin?category=${category}`, {
      method: 'PATCH',
      body: { pinned, category },
    });
    await loadFavorites();
    renderGrid();
    if (detailItem && detailItem.item.symbol === symbol) openDetail(symbol, category);
  }

  function bindEvents() {
    document.querySelectorAll('.market-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.market-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        renderGrid();
      });
    });

    $('market-search').addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderGrid();
    });

    $('crypto-sort').addEventListener('change', (e) => {
      cryptoSort = e.target.value;
      renderGrid();
    });

    $('btn-refresh').addEventListener('click', async () => {
      if (!(await checkVpn(true))) return;
      loadMarket(true);
    });
    $('btn-vpn-retry')?.addEventListener('click', async () => {
      setVpnBlocked(false);
      $('market-loading').style.display = 'block';
      $('market-loading').textContent = 'در حال بررسی اتصال…';
      if (!(await checkVpn(true))) return;
      loadMarket(false);
    });

    $('sheet-overlay').addEventListener('click', () => closeSheet('detail-sheet'));
    document.querySelectorAll('[data-close-sheet]').forEach((b) => {
      b.addEventListener('click', () => closeSheet(b.dataset.closeSheet));
    });

    $('detail-share').addEventListener('click', async () => {
      if (!detailItem) return;
      const text = shareText(detailItem.item, detailItem.category);
      try {
        if (navigator.share) {
          await navigator.share({ text, title: 'دخلیار — نمای بازار' });
        } else {
          await navigator.clipboard.writeText(text);
          showToast('متن کپی شد');
        }
      } catch (_) {
        try {
          await navigator.clipboard.writeText(text);
          showToast('متن کپی شد');
        } catch (e2) {
          window.DakhlyarModal?.alert({ title: 'خطا', message: 'اشتراک‌گذاری ممکن نیست', subType: 'danger' });
        }
      }
    });

    $('market-grid').addEventListener('click', async (e) => {
      const starBtn = e.target.closest('[data-star]');
      if (starBtn) {
        e.stopPropagation();
        await toggleFavorite(starBtn.dataset.star, starBtn.dataset.cat);
        return;
      }
      const card = e.target.closest('.market-card');
      if (card) openDetail(card.dataset.symbol, card.dataset.cat);
    });
  }

  bindEvents();
  (async function boot() {
    $('market-loading').style.display = 'block';
    $('market-loading').textContent = 'در حال بررسی اتصال…';
    if (!(await checkVpn(true))) return;
    await loadMarket(false);
    refreshTimer = setInterval(async () => {
      if (vpnBlocked) return;
      if (!(await checkVpn(false))) return;
      loadMarket(false);
    }, 15 * 60 * 1000);
    cacheAgeTimer = setInterval(() => {
      if (!vpnBlocked) updateCacheAgeLabel();
    }, 60000);
  })();
})();
