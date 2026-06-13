/**
 * avatar.js — Dakhlyar avatar picker (Phase 3-B).
 *
 * Exposes:
 *   window.AvatarPicker   — class with .open() / .close()
 *   window.getAvatarUrl   — same fallback logic as the backend helper
 *
 * The picker is self-contained: it injects its own overlay+modal markup
 * into <body> the first time .open() is called, so any page just needs
 *
 *     const picker = new AvatarPicker({ onChange(url, meta) { ... } });
 *     picker.open();
 *
 * to embed it.
 */
(function () {
  'use strict';

  // ---- shared seed data (kept in sync with server/utils/avatarHelper.js) ----
  const FREE_SEEDS = [
    'aria', 'luna', 'nova', 'sage', 'iris',
    'leo',  'finn', 'zara', 'eden', 'blake',
    'sky',  'rain', 'dawn', 'ash',  'brook',
    'vale', 'reef', 'wren', 'cove', 'fern',
  ];
  const PREMIUM_SEEDS = [
    'orion',  'lyra',   'phoenix','atlas',  'zephyr',
    'aurora', 'draco',  'celeste','soleil', 'nimbus',
    'vega',   'altair', 'sirius', 'cygnus', 'aquila',
    'castor', 'pollux', 'rigel',  'deneb',  'antares',
  ];
  const FREE_BG = [
    'b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf',
    'b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf',
    'b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf',
    'b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf',
  ];
  const PREMIUM_BG = [
    'f4d03f','a9cce3','a9dfbf','f1948a','bb8fce',
    'f7dc6f','85c1e9','82e0aa','f1948a','c39bd3',
    'f4d03f','a9cce3','a9dfbf','f1948a','bb8fce',
    'f7dc6f','85c1e9','82e0aa','f1948a','c39bd3',
  ];
  const BG_COLORS = {};
  FREE_SEEDS.forEach((s, i)    => { BG_COLORS[s] = FREE_BG[i]; });
  PREMIUM_SEEDS.forEach((s, i) => { BG_COLORS[s] = PREMIUM_BG[i]; });
  const PREMIUM_SET = new Set(PREMIUM_SEEDS);
  const DEFAULT_SEED = 'aria';

  function dicebearUrl(seed) {
    const safeSeed = BG_COLORS[seed] ? seed : DEFAULT_SEED;
    return `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(safeSeed)}&backgroundColor=${BG_COLORS[safeSeed]}`;
  }

  function getAvatarUrl(user) {
    if (!user) return dicebearUrl(DEFAULT_SEED);
    if (user.avatar_type === 'custom' && user.avatar_custom_path) return user.avatar_custom_path;
    return dicebearUrl(user.avatar_seed || DEFAULT_SEED);
  }

  // ---- shared fetch helper ----
  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, Object.assign({
      credentials: 'same-origin',
      headers: opts.body instanceof FormData
        ? {} // let the browser set multipart boundary
        : { 'Content-Type': 'application/json' },
    }, opts));
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { status: res.status, ok: res.ok, data: data || {} };
  }

  // ---- tiny utils ----
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function showTooltip(anchor, text) {
    let tip = document.querySelector('.av-tooltip');
    if (!tip) {
      tip = el('div', 'av-tooltip');
      document.body.appendChild(tip);
    }
    tip.textContent = text;
    const r = anchor.getBoundingClientRect();
    tip.style.top  = `${Math.max(8, r.top - 32)}px`;
    tip.style.left = `${Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2)}px`;
    tip.classList.add('show');
    clearTimeout(showTooltip._t);
    showTooltip._t = setTimeout(() => tip.classList.remove('show'), 1800);
  }

  // ============================================================
  //                      AvatarPicker
  // ============================================================

  class AvatarPicker {
    constructor(opts = {}) {
      this.onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
      this.onSubscriptionCta = typeof opts.onSubscriptionCta === 'function'
        ? opts.onSubscriptionCta
        : () => { window.location.hash = '#/subscription'; };
      this.toast = typeof opts.toast === 'function' ? opts.toast : (m) => console.log(m);
      this.state = null;
      this._overlay = null;
      this._activeTab = 'gallery';
    }

    _injectMarkup() {
      if (this._overlay) return;
      const overlay = el('div', 'av-overlay');
      overlay.innerHTML = `
        <div class="av-modal" role="dialog" aria-modal="true" aria-labelledby="avTitle">
          <button class="av-close" aria-label="بستن">×</button>
          <h2 class="av-title" id="avTitle">انتخاب آواتار</h2>

          <div class="av-current-wrap">
            <img class="av-current-img" alt="آواتار فعلی" />
            <small class="av-current-label">آواتار فعلی</small>
          </div>

          <div class="av-tabs" role="tablist">
            <button class="av-tab active" data-tab="gallery"  role="tab">آواتارها</button>
            <button class="av-tab"        data-tab="upload"   role="tab">عکس شخصی</button>
          </div>

          <div class="av-pane active" data-pane="gallery"></div>
          <div class="av-pane"        data-pane="upload"></div>
        </div>`;
      document.body.appendChild(overlay);
      this._overlay = overlay;

      // close handlers
      overlay.querySelector('.av-close').addEventListener('click', () => this.close());
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('open')) this.close();
      });
      // tab switching
      overlay.querySelectorAll('.av-tab').forEach((btn) => {
        btn.addEventListener('click', () => this._setTab(btn.dataset.tab));
      });
    }

    _setTab(tabName) {
      this._activeTab = tabName;
      const ov = this._overlay;
      ov.querySelectorAll('.av-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabName));
      ov.querySelectorAll('.av-pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === tabName));
    }

    async open() {
      this._injectMarkup();
      this._overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      await this._refresh();
    }

    close() {
      if (this._overlay) this._overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    async _refresh() {
      const galleryPane = this._overlay.querySelector('[data-pane="gallery"]');
      const uploadPane  = this._overlay.querySelector('[data-pane="upload"]');
      galleryPane.innerHTML = '<div class="muted" style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">در حال بارگذاری…</div>';
      uploadPane.innerHTML  = '';

      const r = await fetchJson('/api/avatar/list');
      if (r.status === 401) { window.location.href = '/'; return; }
      if (!r.ok) {
        galleryPane.innerHTML = `<div class="muted" style="text-align:center;padding:20px">${r.data.message || 'خطا در بارگذاری'}</div>`;
        return;
      }
      this.state = r.data;
      this._renderHeader();
      this._renderGallery();
      this._renderUploadPane();
    }

    _renderHeader() {
      this._overlay.querySelector('.av-current-img').src = this.state.current.url;
    }

    _renderGallery() {
      const pane = this._overlay.querySelector('[data-pane="gallery"]');
      pane.innerHTML = '';

      const free    = this.state.avatars.filter((a) => !a.is_premium);
      const premium = this.state.avatars.filter((a) =>  a.is_premium);

      pane.appendChild(el('div', 'av-section-title', 'رایگان'));
      pane.appendChild(this._renderGrid(free));

      pane.appendChild(el('div', 'av-section-title', 'ویژه اشتراک'));
      pane.appendChild(this._renderGrid(premium));

      if (!this.state.has_active_subscription) {
        const cta = el('button', 'av-cta-buy', 'خرید اشتراک');
        cta.addEventListener('click', () => {
          this.close();
          this.onSubscriptionCta();
        });
        pane.appendChild(cta);
      }
    }

    _renderGrid(items) {
      const grid = el('div', 'av-grid');
      const currentSeed = this.state.current.type === 'dicebear' ? this.state.current.seed : null;
      items.forEach((a) => {
        const btn = el('button', `av-cell ${a.seed === currentSeed ? 'selected' : ''} ${a.is_locked ? 'locked' : ''}`);
        btn.type = 'button';
        btn.title = a.is_locked ? 'برای دسترسی، اشتراک تهیه کنید' : a.seed;
        const img = el('img');
        img.src = a.url;
        img.alt = a.seed;
        img.loading = 'lazy';
        btn.appendChild(img);
        btn.addEventListener('click', () => this._handleAvatarClick(a, btn));
        grid.appendChild(btn);
      });
      return grid;
    }

    async _handleAvatarClick(avatar, btn) {
      if (avatar.is_locked) {
        showTooltip(btn, 'برای دسترسی به این آواتارها اشتراک تهیه کنید');
        return;
      }
      // optimistic UI — show selected immediately
      this._overlay.querySelectorAll('.av-cell.selected').forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');

      const r = await fetchJson('/api/avatar/select', {
        method: 'PATCH',
        body: JSON.stringify({ seed: avatar.seed }),
      });
      if (r.ok) {
        this.state.current = { type: 'dicebear', seed: avatar.seed, url: r.data.avatar_url, custom_path: null };
        this._renderHeader();
        this._renderUploadPane(); // refresh — custom may have been wiped
        this.toast('آواتار تغییر کرد');
        this._notify(r.data.avatar_url, this.state.current);
      } else {
        this.toast(r.data.message || 'خطا در انتخاب آواتار');
        // refresh to roll back optimistic state
        this._refresh();
      }
    }

    _renderUploadPane() {
      const pane = this._overlay.querySelector('[data-pane="upload"]');
      pane.innerHTML = '';

      if (!this.state.can_upload) {
        const box = el('div', 'av-upload-lock');
        box.innerHTML = `
          <div class="ico">🔒</div>
          <h3>آپلود عکس شخصی</h3>
          <p>آپلود عکس شخصی مخصوص کاربران دارای اشتراک فعال است.<br>
             با خرید اشتراک می‌توانید عکس دلخواه خود را به‌عنوان آواتار استفاده کنید.</p>
        `;
        const cta = el('button', 'av-cta-buy', 'خرید اشتراک');
        cta.addEventListener('click', () => { this.close(); this.onSubscriptionCta(); });
        box.appendChild(cta);
        pane.appendChild(box);
        return;
      }

      const wrap = el('div', 'av-upload-pane');
      const isCustom = this.state.current.type === 'custom' && this.state.current.custom_path;

      const preview = el('div', 'av-preview');
      preview.style.backgroundImage = `url("${isCustom ? this.state.current.url : this.state.current.url}")`;
      wrap.appendChild(preview);

      const fileInput = el('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/jpeg,image/png,image/webp';
      fileInput.style.display = 'none';
      wrap.appendChild(fileInput);

      const actions = el('div', 'av-upload-actions');
      const chooseBtn = el('button', null, isCustom ? 'تغییر عکس' : 'انتخاب عکس');
      const saveBtn   = el('button', null, 'ذخیره');
      const cancelBtn = el('button', 'ghost', 'انصراف');
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      actions.append(chooseBtn, saveBtn, cancelBtn);
      wrap.appendChild(actions);

      const note = el('div', 'av-upload-note',
        'با اتمام اشتراک، عکس شخصی به‌صورت خودکار حذف و آواتار قبلی جایگزین می‌شود. ' +
        'فرمت‌های مجاز: jpg، png، webp — حداکثر ۳ مگابایت.');
      wrap.appendChild(note);

      if (isCustom) {
        const delBtn = el('button', 'av-delete-link', 'حذف عکس و بازگشت به آواتار');
        delBtn.addEventListener('click', () => this._deleteCustom());
        wrap.appendChild(delBtn);
      }

      pane.appendChild(wrap);

      // wire up upload flow
      let pendingFile = null;
      chooseBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        // client-side preflight
        if (f.size > 3 * 1024 * 1024) {
          this.toast('حجم فایل بیش از ۳ مگابایت است');
          fileInput.value = '';
          return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
          this.toast('فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود');
          fileInput.value = '';
          return;
        }
        pendingFile = f;
        preview.style.backgroundImage = `url("${URL.createObjectURL(f)}")`;
        chooseBtn.style.display = 'none';
        saveBtn.style.display   = '';
        cancelBtn.style.display = '';
      });
      cancelBtn.addEventListener('click', () => {
        pendingFile = null;
        fileInput.value = '';
        this._renderUploadPane();
      });
      saveBtn.addEventListener('click', async () => {
        if (!pendingFile) return;
        saveBtn.disabled = true;
        const loadingToken = window.DakhlyarModal
          ? window.DakhlyarModal.loading({ message: 'در حال بارگذاری عکس…' })
          : null;
        const fd = new FormData();
        fd.append('photo', pendingFile);
        const r = await fetchJson('/api/avatar/upload', { method: 'POST', body: fd });
        if (loadingToken) window.DakhlyarModal.closeLoading(loadingToken);
        saveBtn.disabled = false;
        if (r.ok) {
          this.toast(r.data.message || 'عکس بارگذاری شد');
          this.state.current = { type: 'custom', seed: null, url: r.data.avatar_url, custom_path: r.data.avatar_url };
          this._renderHeader();
          this._renderUploadPane();
          this._renderGallery();
          this._notify(r.data.avatar_url, this.state.current);
        } else if (window.DakhlyarModal) {
          window.DakhlyarModal.alert({
            title: 'خطا در بارگذاری',
            message: r.data.message || 'بارگذاری عکس ناموفق بود.',
            subType: 'error',
          });
        } else {
          this.toast(r.data.message || 'خطا در آپلود');
        }
      });
    }

    async _deleteCustom() {
      // Prefer the global modal if it's loaded; fall back to a toast confirm
      // so this picker keeps working on pages that haven't included modal.js
      // (the modal is loaded on every page now, but we stay defensive).
      let ok;
      if (window.DakhlyarModal && typeof window.DakhlyarModal.confirm === 'function') {
        ok = await window.DakhlyarModal.confirm({
          title: 'حذف عکس شخصی',
          message: 'عکس شخصی حذف شود و آواتار قبلی شما (DiceBear) بازگردانده شود؟',
          confirmText: 'حذف',
          cancelText: 'انصراف',
          type: 'danger',
        });
      } else {
        ok = window.confirm('عکس شخصی حذف شود و به آواتار قبلی برگردید؟');
      }
      if (!ok) return;

      const loadingToken = window.DakhlyarModal ? window.DakhlyarModal.loading({ message: 'در حال حذف…' }) : null;
      const r = await fetchJson('/api/avatar/custom', { method: 'DELETE' });
      if (loadingToken) window.DakhlyarModal.closeLoading(loadingToken);

      if (r.ok) {
        this.toast(r.data.message || 'عکس حذف شد');
        this.state.current = { type: 'dicebear', seed: r.data.seed, url: r.data.avatar_url, custom_path: null };
        this._renderHeader();
        this._renderUploadPane();
        this._renderGallery();
        this._notify(r.data.avatar_url, this.state.current);
      } else if (window.DakhlyarModal) {
        window.DakhlyarModal.alert({
          title: 'خطا',
          message: r.data.message || 'خطا در حذف عکس',
          subType: 'error',
        });
      } else {
        this.toast(r.data.message || 'خطا در حذف عکس');
      }
    }

    _notify(url, meta) {
      if (this.onChange) {
        try { this.onChange(url, meta); } catch (e) { console.warn(e); }
      }
    }
  }

  window.AvatarPicker = AvatarPicker;
  window.getAvatarUrl = getAvatarUrl;
})();
