(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pd = (n) => (window.toPersianDigits ? window.toPersianDigits(n) : String(n));
  const fmtNum = (n, dec) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return pd('0');
    return pd(num.toLocaleString('en', {
      minimumFractionDigits: dec != null ? dec : 0,
      maximumFractionDigits: dec != null ? dec : 0,
    }));
  };

  const HIDE_KEY = 'dakhlyar_assets_hide_value';
  const COMP_COLORS = {
    gold: '#F0B429',
    coin: '#D97706',
    currency: '#10B981',
    crypto: '#6366F1',
    commodity: '#F59E0B',
    real_estate: '#8B5CF6',
    vehicle: '#3B82F6',
    cash: '#1A5C3A',
    investment: '#EC4899',
    other: '#6B7280',
  };

  const CATEGORY_LABELS = {
    gold: 'طلا',
    coin: 'سکه',
    currency: 'ارز',
    crypto: 'کریپتو',
    commodity: 'کامودیتی',
    real_estate: 'ملک',
    vehicle: 'خودرو',
    cash: 'نقد',
    investment: 'سرمایه‌گذاری',
    other: 'سایر',
  };

  const TYPE_GROUPS = [
    { label: 'طلا و سکه', keys: ['gold_18k', 'gold_24k', 'gold_melted', 'coin_emami', 'coin_bahar', 'coin_half', 'coin_quarter', 'coin_1gr'] },
    { label: 'ارز', keys: ['usd', 'eur'] },
    { label: 'ارز دیجیتال', keys: ['bitcoin', 'ethereum', 'tether'] },
    { label: 'کامودیتی', keys: ['gold_ounce'] },
    { label: 'ملک و خودرو', keys: ['property', 'car'] },
    { label: 'سرمایه‌گذاری', keys: ['stocks', 'fund'] },
    { label: 'سایر', keys: ['cash_toman', 'bank_deposit', 'other'] },
  ];

  const ASSET_ICONS = {
    coin: '/img/market/coin-bahar-azadi.png',
    gold: '/img/market/gold-bar.png',
    silver: '/img/market/silver-bar.png',
  };

  function assetIconKind(type) {
    if (!type) return null;
    const key = String(type.key || '');
    const cat = String(type.category || '');
    const name = String(type.name || '');
    if (cat === 'coin' || key.startsWith('coin_')) return 'coin';
    if (/silver|نقره|xag/i.test(key) || /نقره/.test(name)) return 'silver';
    if (cat === 'gold' || key.startsWith('gold_')) return 'gold';
    return null;
  }

  function assetIconHtml(type) {
    const kind = assetIconKind(type);
    if (kind && ASSET_ICONS[kind]) {
      const cls = kind === 'coin' ? 'asset-icon-img is-coin' : 'asset-icon-img';
      return `<img src="${ASSET_ICONS[kind]}" alt="" loading="lazy" class="${cls}">`;
    }
    return type?.icon || '📦';
  }

  const PRICE_SOURCE_LABELS = {
    market: { cls: 'market', text: 'قیمت بازار' },
    manual: { cls: 'manual', text: 'قیمت دستی' },
    unavailable: { cls: 'missing', text: 'قیمت ناموجود' },
  };

  let assetTypes = [];
  let portfolio = { assets: [], total_value: 0, by_category: [], market_data_age_minutes: null };
  let historyData = { snapshots: [], change_7d: { value: 0, percent: 0 }, change_30d: { value: 0, percent: 0 } };
  let activeFilter = 'all';
  let editMode = false;
  let hideValues = localStorage.getItem(HIDE_KEY) === '1';
  let selectedAsset = null;
  let formState = {
    editId: null,
    assetKey: null,
    useMarketPrice: true,
    riskLevel: 'medium',
  };

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

  function getType(key) {
    return assetTypes.find((t) => t.key === key) || null;
  }

  function masked(val) {
    return hideValues ? '••••••••' : val;
  }

  function changeClass(v) {
    if (v > 0) return 'up';
    if (v < 0) return 'down';
    return '';
  }

  function formatChange(item) {
    const sign = item.value >= 0 ? '+' : '−';
    return `${sign}${fmtNum(Math.abs(item.value))} (${sign}${fmtNum(Math.abs(item.percent), 1)}٪)`;
  }

  function priceSourceHtml(source) {
    const meta = PRICE_SOURCE_LABELS[source] || PRICE_SOURCE_LABELS.unavailable;
    return `<span class="price-source-dot ${meta.cls}"></span>${meta.text}`;
  }

  function renderShell() {
    const container = $('main-content');
    container.innerHTML = `
      <div id="assets-loading" class="asset-loading">در حال بارگذاری…</div>
      <div id="assets-app" style="display:none;">
        <section class="asset-hero">
          <div class="asset-hero-label">ارزش حدودی کل دارایی</div>
          <div class="asset-hero-value">
            <span class="asset-hero-approx">~</span>
            <span id="hero-value">۰</span>
            <span class="asset-hero-approx">تومان</span>
            <button type="button" class="asset-hero-toggle" id="btn-toggle-hide" aria-label="نمایش/پنهان">👁</button>
          </div>
          <div class="asset-hero-updated" id="hero-updated">—</div>
        </section>

        <div class="asset-hero-actions">
          <button type="button" class="asset-action-btn primary" id="btn-add-asset">
            <i class="ti ti-plus"></i> افزودن دارایی
          </button>
          <button type="button" class="asset-action-btn secondary" id="btn-edit-mode">
            <i class="ti ti-pencil"></i> ویرایش دارایی
          </button>
          <button type="button" class="asset-action-btn secondary" id="btn-composition">
            <i class="ti ti-chart-pie"></i> ترکیب دارایی
          </button>
        </div>

        <section class="asset-history-card" id="history-card">
          <h4>خلاصه خالص دارایی</h4>
          <div class="asset-history-row">
            <span>تغییر ۷ روز:</span>
            <strong id="hist-7d" class="">—</strong>
          </div>
          <div class="asset-history-row">
            <span>تغییر ۳۰ روز:</span>
            <strong id="hist-30d" class="">—</strong>
          </div>
          <button type="button" class="asset-history-link" id="btn-history">مشاهده تاریخچه</button>
        </section>

        <div class="asset-filter-tabs" id="filter-tabs">
          <button type="button" class="asset-filter-tab active" data-filter="all">همه</button>
          <button type="button" class="asset-filter-tab" data-filter="safe">امن</button>
          <button type="button" class="asset-filter-tab" data-filter="medium">بدون ریسک</button>
          <button type="button" class="asset-filter-tab" data-filter="risky">ریسکی</button>
        </div>

        <div class="asset-list-wrap">
          <div id="asset-list"></div>
          <div id="asset-empty" class="asset-empty" style="display:none;">
            <div class="icon">📦</div>
            <h3>هنوز دارایی ثبت نشده</h3>
            <p>طلای خود، سکه، ارز، ملک و سایر دارایی‌ها را ثبت کنید تا ارزش تقریبی سبدتان محاسبه شود.</p>
            <button type="button" class="asset-action-btn primary" id="btn-empty-add" style="max-width:220px;margin:0 auto;">افزودن اولین دارایی</button>
          </div>
        </div>
      </div>
    `;

    $('btn-header-add').addEventListener('click', () => openFormSheet());
    $('btn-add-asset').addEventListener('click', () => openFormSheet());
    $('btn-empty-add').addEventListener('click', () => openFormSheet());
    $('btn-edit-mode').addEventListener('click', toggleEditMode);
    $('btn-composition').addEventListener('click', openCompositionSheet);
    $('btn-history').addEventListener('click', openHistorySheet);
    $('btn-toggle-hide').addEventListener('click', toggleHideValues);

    $('filter-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-filter]');
      if (!tab) return;
      activeFilter = tab.dataset.filter;
      document.querySelectorAll('.asset-filter-tab').forEach((el) => {
        el.classList.toggle('active', el.dataset.filter === activeFilter);
      });
      renderList();
    });

    $('asset-form-save').addEventListener('click', saveForm);
    $('asset-detail-edit').addEventListener('click', () => {
      if (!selectedAsset) return;
      closeSheet('asset-detail-sheet');
      openFormSheet(selectedAsset);
    });
    $('asset-detail-delete').addEventListener('click', deleteSelectedAsset);

    $('sheet-overlay').addEventListener('click', () => {
      closeSheet('asset-form-sheet');
      closeSheet('asset-detail-sheet');
      closeSheet('composition-sheet');
      closeSheet('history-sheet');
    });
    document.querySelectorAll('[data-close-sheet]').forEach((btn) => {
      btn.addEventListener('click', () => closeSheet(btn.dataset.closeSheet));
    });
  }

  function toggleHideValues() {
    hideValues = !hideValues;
    localStorage.setItem(HIDE_KEY, hideValues ? '1' : '0');
    renderHero();
    renderList();
  }

  function toggleEditMode() {
    editMode = !editMode;
    $('btn-edit-mode').classList.toggle('primary', editMode);
    $('btn-edit-mode').classList.toggle('secondary', !editMode);
    renderList();
  }

  function openSheet(id) {
    $('sheet-overlay').classList.add('show');
    const s = $(id);
    if (s) requestAnimationFrame(() => s.classList.add('show'));
  }

  function closeSheet(id) {
    const s = $(id);
    if (s) s.classList.remove('show');
    if (!document.querySelector('.dk-sheet.show')) {
      $('sheet-overlay').classList.remove('show');
    }
  }

  function filteredAssets() {
    if (activeFilter === 'all') return portfolio.assets;
    return portfolio.assets.filter((a) => a.risk_level === activeFilter);
  }

  function renderHero() {
    $('hero-value').textContent = masked(fmtNum(portfolio.total_value));
    const age = portfolio.market_data_age_minutes;
    $('hero-updated').textContent = age == null
      ? 'آخرین بروزرسانی: —'
      : age === 0
        ? 'آخرین بروزرسانی: همین الان'
        : `آخرین بروزرسانی: ${pd(age)} دقیقه پیش`;
  }

  function renderHistoryCard() {
    const el7 = $('hist-7d');
    const el30 = $('hist-30d');
    el7.textContent = masked(formatChange(historyData.change_7d));
    el30.textContent = masked(formatChange(historyData.change_30d));
    el7.className = changeClass(historyData.change_7d.value);
    el30.className = changeClass(historyData.change_30d.value);
  }

  function renderList() {
    const list = filteredAssets();
    const wrap = $('asset-list');
    const empty = $('asset-empty');
    if (!list.length) {
      wrap.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    wrap.innerHTML = list.map((a) => {
      const type = a.type || {};
      const cat = CATEGORY_LABELS[type.category] || type.category || '';
      let qtyLine = '';
      if (type.unit && type.price_per_unit !== false) {
        qtyLine = `مقدار: ${fmtNum(a.quantity, type.unit === 'گرم' ? 3 : 0)} ${type.unit}`;
      } else if (type.unit) {
        qtyLine = `مقدار: ${fmtNum(a.quantity, 0)} ${type.unit}`;
      }
      let marketLine = '';
      if (a.market_price_used != null && type.price_per_unit) {
        marketLine = `<small>قیمت: ${fmtNum(a.market_price_used)} ت/${type.unit || 'واحد'}</small>`;
      } else if (a.price_source === 'manual' && !type.price_per_unit) {
        marketLine = `<small>${priceSourceHtml('manual')}</small>`;
      } else {
        marketLine = `<small>${priceSourceHtml(a.price_source)}</small>`;
      }
      return `
        <article class="asset-row${editMode ? ' edit-mode' : ''}" data-id="${a.id}">
          <div class="asset-row-actions">
            <button type="button" data-edit="${a.id}" aria-label="ویرایش"><i class="ti ti-pencil"></i></button>
            <button type="button" data-del="${a.id}" aria-label="حذف"><i class="ti ti-trash"></i></button>
          </div>
          <div class="asset-row-icon">${assetIconHtml(type)}</div>
          <div class="asset-row-body">
            <div class="asset-row-top">
              <div class="asset-row-name">${a.display_name}</div>
              <span class="asset-row-cat">${cat}</span>
            </div>
            ${qtyLine ? `<div class="asset-row-qty">${qtyLine}</div>` : ''}
            <div class="asset-row-value">
              ارزش: ${masked(fmtNum(a.toman_value))} تومان
              ${marketLine}
            </div>
          </div>
        </article>`;
    }).join('');

    wrap.querySelectorAll('.asset-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit]')) {
          e.stopPropagation();
          const id = Number(e.target.closest('[data-edit]').dataset.edit);
          const asset = portfolio.assets.find((x) => x.id === id);
          if (asset) openFormSheet(asset);
          return;
        }
        if (e.target.closest('[data-del]')) {
          e.stopPropagation();
          const id = Number(e.target.closest('[data-del]').dataset.del);
          confirmDelete(id);
          return;
        }
        if (editMode) return;
        const id = Number(row.dataset.id);
        const asset = portfolio.assets.find((x) => x.id === id);
        if (asset) openDetailSheet(asset);
      });
    });
  }

  function openDetailSheet(asset) {
    selectedAsset = asset;
    $('asset-detail-title').textContent = asset.display_name;
    const type = asset.type || {};
    let rows = `
      <div class="asset-detail-row"><span class="lbl">نوع</span><span class="val">${type.name || '—'}</span></div>
      <div class="asset-detail-row"><span class="lbl">ارزش</span><span class="val">${fmtNum(asset.toman_value)} تومان</span></div>
      <div class="asset-detail-row"><span class="lbl">منبع قیمت</span><span class="val">${priceSourceHtml(asset.price_source)}</span></div>`;
    if (type.unit) {
      rows += `<div class="asset-detail-row"><span class="lbl">مقدار</span><span class="val">${fmtNum(asset.quantity, 3)} ${type.unit}</span></div>`;
    }
    if (asset.market_price_used != null) {
      rows += `<div class="asset-detail-row"><span class="lbl">قیمت واحد</span><span class="val">${fmtNum(asset.market_price_used)} تومان</span></div>`;
    }
    if (asset.note) {
      rows += `<div class="asset-detail-row"><span class="lbl">یادداشت</span><span class="val">${asset.note}</span></div>`;
    }
    $('asset-detail-body').innerHTML = rows;
    openSheet('asset-detail-sheet');
  }

  function buildTypeGrid(selectedKey) {
    let html = '';
    for (const group of TYPE_GROUPS) {
      html += `<div class="asset-type-group-title">${group.label}</div>`;
      html += '<div class="asset-type-grid">';
      for (const key of group.keys) {
        const t = getType(key);
        if (!t) continue;
        html += `
          <button type="button" class="asset-type-tile${selectedKey === key ? ' active' : ''}"
                  data-key="${key}">
            <span class="icon">${assetIconHtml(t)}</span>
            <span class="name">${t.name}</span>
          </button>`;
      }
      html += '</div>';
    }
    return html;
  }

  function estimatePreview(type, quantity, manualPrice, useMarket) {
    if (!type) return 0;
    if (!type.has_market_price) {
      if (type.price_per_unit) return Math.round(quantity * (manualPrice || 0));
      return Math.round(manualPrice || 0);
    }
    if (!useMarket && manualPrice > 0) return Math.round(quantity * manualPrice);
    const asset = portfolio.assets.find((a) => a.asset_key === type.key && a.price_source === 'market');
    if (asset && asset.market_price_used) return Math.round(quantity * asset.market_price_used);
    return manualPrice > 0 ? Math.round(quantity * manualPrice) : 0;
  }

  function renderFormFields() {
    const type = getType(formState.assetKey);
    const body = $('asset-form-body');
    if (!type) {
      body.innerHTML = `
        <p style="font-size:13px;color:var(--color-text-2);margin:0 0 12px;">نوع دارایی را انتخاب کنید:</p>
        ${buildTypeGrid(null)}
      `;
      body.querySelectorAll('.asset-type-tile').forEach((tile) => {
        tile.addEventListener('click', () => {
          formState.assetKey = tile.dataset.key;
          formState.useMarketPrice = getType(formState.assetKey)?.has_market_price !== false;
          renderFormFields();
        });
      });
      return;
    }

    const showQty = type.price_per_unit !== false && type.unit;
    const needsManual = !type.has_market_price;
    const showManual = needsManual || !formState.useMarketPrice;
    const manualLabel = type.price_per_unit
      ? (type.has_market_price ? `قیمت هر ${type.unit}` : `مبلغ هر ${type.unit}`)
      : 'ارزش کل (تومان)';

    body.innerHTML = `
      <p style="font-size:13px;color:var(--color-text-2);margin:0 0 8px;">نوع: <strong>${type.name}</strong>
        <button type="button" id="btn-change-type" style="border:none;background:none;color:var(--color-primary);font-size:12px;cursor:pointer;font-family:inherit;">تغییر</button>
      </p>
      ${showQty ? `
      <div class="asset-form-field">
        <label for="fld-quantity">مقدار</label>
        <div class="asset-qty-wrap">
          <input id="fld-quantity" class="ltr" type="text" inputmode="decimal" placeholder="0" />
          <span class="asset-qty-unit">${type.unit}</span>
        </div>
      </div>` : ''}
      ${type.has_market_price ? `
      <label class="asset-market-toggle">
        <input type="checkbox" id="fld-use-market" ${formState.useMarketPrice ? 'checked' : ''} />
        استفاده از قیمت بازار
      </label>` : ''}
      ${showManual ? `
      <div class="asset-form-field" id="manual-field">
        <label for="fld-manual">${manualLabel}</label>
        <input id="fld-manual" class="ltr" type="text" inputmode="numeric" placeholder="0" />
      </div>` : ''}
      <div class="asset-form-field">
        <label for="fld-custom">نام دلخواه (اختیاری)</label>
        <input id="fld-custom" type="text" maxlength="40" placeholder="مثلاً طلای خانوادگی" />
      </div>
      <div class="asset-form-field">
        <label for="fld-note">یادداشت (اختیاری)</label>
        <textarea id="fld-note" maxlength="200" placeholder="توضیح کوتاه…"></textarea>
      </div>
      <div class="asset-form-field">
        <label>سطح ریسک</label>
        <div class="asset-risk-pills">
          <button type="button" class="asset-risk-pill${formState.riskLevel === 'safe' ? ' active' : ''}" data-risk="safe">امن</button>
          <button type="button" class="asset-risk-pill${formState.riskLevel === 'medium' ? ' active' : ''}" data-risk="medium">متوسط</button>
          <button type="button" class="asset-risk-pill${formState.riskLevel === 'risky' ? ' active' : ''}" data-risk="risky">ریسکی</button>
        </div>
      </div>
      <div class="asset-preview-card">
        <span class="asset-preview-label">ارزش تخمینی</span>
        <span class="asset-preview-value" id="preview-value">۰ تومان</span>
      </div>
    `;

    $('btn-change-type').addEventListener('click', () => {
      formState.assetKey = null;
      renderFormFields();
    });

    if ($('fld-use-market')) {
      $('fld-use-market').addEventListener('change', (e) => {
        formState.useMarketPrice = e.target.checked;
        renderFormFields();
      });
    }

    body.querySelectorAll('.asset-risk-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        formState.riskLevel = pill.dataset.risk;
        body.querySelectorAll('.asset-risk-pill').forEach((p) => {
          p.classList.toggle('active', p.dataset.risk === formState.riskLevel);
        });
      });
    });

    ['fld-quantity', 'fld-manual'].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener('input', updatePreview);
    });

    updatePreview();
  }

  function parseInputNum(id, fallback) {
    const el = $(id);
    if (!el) return fallback;
    const raw = String(el.value || '').replace(/[,،]/g, '').trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function updatePreview() {
    const type = getType(formState.assetKey);
    if (!type) return;
    const qty = type.price_per_unit !== false ? parseInputNum('fld-quantity', 0) : 1;
    const manual = parseInputNum('fld-manual', 0);
    const val = estimatePreview(type, qty, manual, formState.useMarketPrice);
    $('preview-value').textContent = `${fmtNum(val)} تومان`;
  }

  function openFormSheet(asset) {
    if (asset) {
      formState = {
        editId: asset.id,
        assetKey: asset.asset_key,
        useMarketPrice: asset.price_source === 'market',
        riskLevel: asset.risk_level || 'medium',
      };
      $('asset-form-title').textContent = 'ویرایش دارایی';
    } else {
      formState = { editId: null, assetKey: null, useMarketPrice: true, riskLevel: 'medium' };
      $('asset-form-title').textContent = 'افزودن دارایی';
    }
    renderFormFields();
    openSheet('asset-form-sheet');

    if (asset) {
      requestAnimationFrame(() => {
        const type = getType(asset.asset_key);
        if ($('fld-quantity') && type?.unit) {
          $('fld-quantity').value = String(asset.quantity).replace('.', '/');
        }
        if ($('fld-manual') && asset.manual_price != null) {
          $('fld-manual').value = String(asset.manual_price);
        }
        if ($('fld-custom') && asset.custom_name) $('fld-custom').value = asset.custom_name;
        if ($('fld-note') && asset.note) $('fld-note').value = asset.note;
        updatePreview();
      });
    }
  }

  async function saveForm() {
    const type = getType(formState.assetKey);
    if (!type) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: 'نوع دارایی را انتخاب کنید', subType: 'error' });
      return;
    }

    const quantity = type.price_per_unit !== false
      ? parseInputNum('fld-quantity', 0)
      : 1;
    if (!quantity || quantity <= 0) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: 'مقدار دارایی باید بزرگ‌تر از صفر باشد', subType: 'error' });
      return;
    }

    let manualPrice = null;
    const needsManual = !type.has_market_price || !formState.useMarketPrice;
    if (needsManual) {
      manualPrice = parseInputNum('fld-manual', null);
      if (manualPrice == null || manualPrice <= 0) {
        window.DakhlyarModal?.alert({ title: 'خطا', message: 'وارد کردن قیمت الزامی است', subType: 'error' });
        return;
      }
      manualPrice = Math.round(manualPrice);
    } else if ($('fld-manual') && $('fld-manual').value.trim()) {
      manualPrice = Math.round(parseInputNum('fld-manual', 0));
    }

    const payload = {
      asset_key: type.key,
      quantity,
      custom_name: $('fld-custom')?.value.trim() || null,
      manual_price: needsManual ? manualPrice : (formState.useMarketPrice ? null : manualPrice),
      note: $('fld-note')?.value.trim() || null,
      risk_level: formState.riskLevel,
    };

    try {
      $('asset-form-save').disabled = true;
      if (formState.editId) {
        await api(`/api/assets/${formState.editId}`, { method: 'PATCH', body: payload });
      } else {
        await api('/api/assets', { method: 'POST', body: payload });
      }
      closeSheet('asset-form-sheet');
      await loadAll();
    } catch (err) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: err.message, subType: 'error' });
    } finally {
      $('asset-form-save').disabled = false;
    }
  }

  async function confirmDelete(id) {
    const ok = await window.DakhlyarModal?.confirm({
      title: 'حذف دارایی',
      message: 'این دارایی از لیست حذف شود؟',
      confirmText: 'حذف',
      cancelText: 'انصراف',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/api/assets/${id}`, { method: 'DELETE' });
      closeSheet('asset-detail-sheet');
      await loadAll();
    } catch (err) {
      window.DakhlyarModal?.alert({ title: 'خطا', message: err.message, subType: 'error' });
    }
  }

  async function deleteSelectedAsset() {
    if (!selectedAsset) return;
    await confirmDelete(selectedAsset.id);
  }

  function openCompositionSheet() {
    const data = (portfolio.by_category || [])
      .filter((c) => c.total > 0)
      .map((c) => ({
        label: c.label,
        value: c.total,
        color: COMP_COLORS[c.category] || '#6B7280',
      }));
    if (!data.length) {
      window.DakhlyarModal?.alert({ title: 'اطلاع', message: 'داده‌ای برای نمایش وجود ندارد', subType: 'info' });
      return;
    }
    if (window.Charts?.drawDonut) {
      Charts.drawDonut('composition-donut', data, fmtNum(portfolio.total_value));
    }
    $('composition-legend').innerHTML = data.map((d) => {
      const pct = portfolio.total_value > 0
        ? Math.round((d.value / portfolio.total_value) * 1000) / 10
        : 0;
      return `
        <div class="asset-composition-legend-row">
          <span><span class="asset-legend-dot" style="background:${d.color}"></span>${d.label}</span>
          <span>${fmtNum(d.value)} (${pd(pct)}٪)</span>
        </div>`;
    }).join('');
    openSheet('composition-sheet');
  }

  function openHistorySheet() {
    const list = historyData.snapshots || [];
    if (!list.length) {
      $('history-list').innerHTML = '<p style="text-align:center;color:var(--color-text-3);font-size:13px;">هنوز تاریخچه‌ای ثبت نشده</p>';
    } else {
      $('history-list').innerHTML = list.map((s) => `
        <div class="asset-history-item">
          <span>${s.created_at ? pd(String(s.created_at).slice(0, 16).replace('T', ' ')) : '—'}</span>
          <strong>${fmtNum(s.total_value)} تومان</strong>
        </div>
      `).join('');
    }
    openSheet('history-sheet');
  }

  async function loadAll() {
    $('assets-loading').style.display = 'block';
    $('assets-app').style.display = 'none';
    try {
      if (!assetTypes.length) {
        const typesRes = await api('/api/assets/types');
        assetTypes = typesRes.types || [];
      }
      portfolio = await api('/api/assets');
      historyData = await api('/api/assets/history?days=30');
      $('assets-loading').style.display = 'none';
      $('assets-app').style.display = 'block';
      renderHero();
      renderHistoryCard();
      renderList();
    } catch (err) {
      $('assets-loading').textContent = err.message || 'خطا در بارگذاری';
    }
  }

  function init() {
    checkSubscriptionGate(
      () => {
        renderShell();
        loadAll();
        DakhlyarNav.init('assets');
      },
      () => showLockedScreen($('main-content'), 'دارایی‌ها')
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
