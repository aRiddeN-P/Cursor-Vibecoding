(function () {
  const INTERNAL_PAGES = [
    { path: '/dashboard.html', label: 'داشبورد' },
    { path: '/market.html', label: 'بازار' },
    { path: '/goals.html', label: 'اهداف' },
    { path: '/assets.html', label: 'دارایی‌ها' },
    { path: '/expert.html', label: 'پیشنهادات کارشناس' },
    { path: '/transactions.html', label: 'تراکنش‌ها' },
    { path: '/reports.html', label: 'گزارش‌ها' },
    { path: '/profile.html', label: 'پروفایل' },
    { path: '/messages.html', label: 'پیام‌ها' },
    { path: '/score.html', label: 'امتیاز' },
    { path: '/split.html', label: 'تسهیم هزینه' },
  ];

  let banners = [];
  let stats = {};
  let editingId = null;
  let expandedId = null;

  const tbody = document.getElementById('banners-tbody');
  const modal = document.getElementById('banner-modal');
  const form = document.getElementById('banner-form');
  const fileInput = document.getElementById('banner-file');
  const previewImg = document.getElementById('banner-preview');
  const currentImg = document.getElementById('banner-current-img');
  const linkTypeRadios = form.querySelectorAll('input[name="link_type"]');
  const internalWrap = document.getElementById('internal-link-wrap');
  const externalWrap = document.getElementById('external-link-wrap');
  const internalSelect = document.getElementById('banner-internal-page');
  const externalInput = document.getElementById('banner-external-url');

  INTERNAL_PAGES.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.path;
    opt.textContent = p.label;
    internalSelect.appendChild(opt);
  });

  function formatRange(start, end) {
    if (!start || !end) return '—';
    return `${AdminAPI.formatDateTime(start)} — ${AdminAPI.formatDateTime(end)}`;
  }

  async function setupBannerDatePickers(startValue, endValue) {
    const startsEl = document.getElementById('banner-starts');
    const endsEl = document.getElementById('banner-ends');
    await AdminDatePicker.init(startsEl, { value: startValue });
    await AdminDatePicker.init(endsEl, { value: endValue });
  }

  function statusBadge(status) {
    const map = {
      active: ['فعال', 'green'],
      scheduled: ['زمان‌بندی شده', 'blue'],
      expired: ['منقضی', 'gray'],
      disabled: ['غیرفعال', 'red'],
    };
    const [label, cls] = map[status] || ['نامشخص', 'gray'];
    return `<span class="admin-badge ${cls}">${label}</span>`;
  }

  function avgCtr() {
    if (!banners.length) return 0;
    const sum = banners.reduce((a, b) => a + (b.ctr || 0), 0);
    return Math.round((sum / banners.length) * 100) / 100;
  }

  function miniBarChart(clicks) {
    const days = 7;
    const total = Number(clicks) || 0;
    const vals = Array.from({ length: days }, (_, i) => Math.max(0, Math.round(total / days + (i % 3) - 1)));
    const max = Math.max(...vals, 1);
    const w = 140;
    const h = 36;
    const barW = Math.floor(w / days) - 2;
    let bars = '';
    vals.forEach((v, i) => {
      const bh = Math.max(2, Math.round((v / max) * h));
      const x = i * (barW + 2);
      bars += `<rect x="${x}" y="${h - bh}" width="${barW}" height="${bh}" fill="#1A5C3A" rx="2"/>`;
    });
    return `<svg width="${w}" height="${h + 4}" class="banner-mini-chart">${bars}</svg>`;
  }

  function renderStatsPills() {
    document.getElementById('stat-active').textContent =
      `${AdminAPI.pd(stats.active_now || 0)} بنر فعال`;
    document.getElementById('stat-impressions').textContent =
      `${AdminAPI.pd(stats.total_impressions || 0)} نمایش`;
    document.getElementById('stat-clicks').textContent =
      `${AdminAPI.pd(stats.total_clicks || 0)} کلیک`;
  }

  function renderTable() {
    if (!banners.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="admin-empty-msg">بنری ثبت نشده است</td></tr>`;
      return;
    }

    const avg = avgCtr();
    tbody.innerHTML = banners.map((b) => {
      const expanded = expandedId === b.id;
      const ctrDiff = (b.ctr || 0) - avg;
      const ctrText = ctrDiff >= 0
        ? `${AdminAPI.pd(Math.abs(ctrDiff))}% بالاتر از میانگین`
        : `${AdminAPI.pd(Math.abs(ctrDiff))}% پایین‌تر از میانگین`;

      return `
        <tr data-id="${b.id}">
          <td><img class="banner-thumb" src="${b.image_url}" alt="" /></td>
          <td>${b.title || '—'}</td>
          <td>${statusBadge(b.status)}</td>
          <td>${formatRange(b.starts_at, b.ends_at)}</td>
          <td>${AdminAPI.pd(b.display_order)}</td>
          <td>${AdminAPI.pd(b.impression_count)}</td>
          <td>${AdminAPI.pd(b.click_count)}</td>
          <td>${AdminAPI.pd(b.ctr)}%</td>
          <td>
            <button type="button" class="admin-btn secondary sm" data-edit="${b.id}">ویرایش</button>
            <button type="button" class="admin-btn secondary sm" data-toggle="${b.id}">${b.is_active ? 'غیرفعال' : 'فعال'}</button>
            <button type="button" class="admin-btn danger sm" data-delete="${b.id}">حذف</button>
            <button type="button" class="admin-btn secondary sm" data-expand="${b.id}">${expanded ? '▲' : '▼'}</button>
          </td>
        </tr>
        ${expanded ? `
        <tr class="banner-stats-row">
          <td colspan="9">
            <div class="banner-stats-panel">
              <div>
                <div class="rec-preview-label">کلیک در ۷ روز گذشته (تخمینی)</div>
                ${miniBarChart(b.click_count)}
              </div>
              <div class="banner-ctr-compare">
                CTR این بنر: <strong>${AdminAPI.pd(b.ctr)}%</strong><br/>
                میانگین CTR: <strong>${AdminAPI.pd(avg)}%</strong><br/>
                ${ctrText}
              </div>
            </div>
          </td>
        </tr>` : ''}`;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openEdit(Number(btn.dataset.edit)));
    });
    tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => toggleActive(Number(btn.dataset.toggle)));
    });
    tbody.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteBanner(Number(btn.dataset.delete)));
    });
    tbody.querySelectorAll('[data-expand]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.expand);
        expandedId = expandedId === id ? null : id;
        renderTable();
      });
    });
  }

  function updateLinkFields() {
    const type = form.querySelector('input[name="link_type"]:checked')?.value || 'external';
    internalWrap.classList.toggle('hidden', type !== 'internal');
    externalWrap.classList.toggle('hidden', type !== 'external');
  }

  linkTypeRadios.forEach((r) => r.addEventListener('change', updateLinkFields));

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    previewImg.src = URL.createObjectURL(file);
    previewImg.classList.remove('hidden');
  });

  function openCreate() {
    editingId = null;
    document.getElementById('banner-modal-title').textContent = 'آپلود بنر جدید';
    form.reset();
    previewImg.classList.add('hidden');
    currentImg.classList.add('hidden');
    fileInput.required = true;
    form.querySelector('input[name="link_type"][value="internal"]').checked = true;
    updateLinkFields();
    adminOpenModal('banner-modal');
    setupBannerDatePickers(new Date(), new Date(Date.now() + 7 * 86400000));
  }

  function openEdit(id) {
    const b = banners.find((x) => x.id === id);
    if (!b) return;
    editingId = id;
    document.getElementById('banner-modal-title').textContent = 'ویرایش بنر';
    document.getElementById('banner-title').value = b.title || '';
    form.querySelector(`input[name="link_type"][value="${b.link_type}"]`).checked = true;
    if (b.link_type === 'internal') {
      internalSelect.value = b.link_url;
    } else {
      externalInput.value = b.link_url;
    }
    document.getElementById('banner-order').value = b.display_order;
    fileInput.required = false;
    fileInput.value = '';
    previewImg.classList.add('hidden');
    currentImg.src = b.image_url;
    currentImg.classList.remove('hidden');
    updateLinkFields();
    adminOpenModal('banner-modal');
    setupBannerDatePickers(b.starts_at, b.ends_at);
  }

  function closeModal() {
    adminCloseModal('banner-modal');
    editingId = null;
  }

  async function load() {
    try {
      const [listData, statsData] = await Promise.all([
        AdminAPI.get('/api/admin/banners?include_inactive=true'),
        AdminAPI.get('/api/admin/banners/stats'),
      ]);
      banners = listData.banners || [];
      stats = statsData;
      renderStatsPills();
      renderTable();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا در بارگذاری', 'error');
    }
  }

  async function toggleActive(id) {
    const b = banners.find((x) => x.id === id);
    if (!b) return;
    try {
      await AdminAPI.patch(`/api/admin/banners/${id}`, { is_active: b.is_active ? 0 : 1 });
      AdminAPI.showToast('وضعیت بنر بروزرسانی شد');
      await load();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function deleteBanner(id) {
    if (!await AdminAPI.confirm('این بنر حذف شود؟', { danger: true, confirmLabel: 'حذف' })) return;
    try {
      await AdminAPI.delete(`/api/admin/banners/${id}`);
      AdminAPI.showToast('بنر حذف شد');
      await load();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const linkType = form.querySelector('input[name="link_type"]:checked').value;
    const linkUrl = linkType === 'internal' ? internalSelect.value : externalInput.value.trim();
    if (!linkUrl) {
      AdminAPI.showToast('لینک مقصد را وارد کنید', 'error');
      return;
    }

    const startsAt = AdminDatePicker.getIso(document.getElementById('banner-starts'));
    const endsAt = AdminDatePicker.getIso(document.getElementById('banner-ends'));
    if (!startsAt || !endsAt) {
      AdminAPI.showToast('تاریخ شروع و پایان را انتخاب کنید', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('title', document.getElementById('banner-title').value.trim());
    fd.append('link_url', linkUrl);
    fd.append('link_type', linkType);
    fd.append('starts_at', startsAt);
    fd.append('ends_at', endsAt);
    fd.append('display_order', document.getElementById('banner-order').value);
    if (fileInput.files[0]) fd.append('image', fileInput.files[0]);

    try {
      if (editingId) {
        await AdminAPI.upload(`/api/admin/banners/${editingId}`, fd, 'PATCH');
        AdminAPI.showToast('بنر بروزرسانی شد');
      } else {
        if (!fileInput.files[0]) {
          AdminAPI.showToast('تصویر بنر الزامی است', 'error');
          return;
        }
        await AdminAPI.upload('/api/admin/banners', fd);
        AdminAPI.showToast('بنر آپلود شد');
      }
      closeModal();
      await load();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  });

  document.getElementById('btn-new-banner').addEventListener('click', openCreate);
  document.getElementById('banner-modal-close').addEventListener('click', closeModal);
  document.getElementById('banner-modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  load();
})();
