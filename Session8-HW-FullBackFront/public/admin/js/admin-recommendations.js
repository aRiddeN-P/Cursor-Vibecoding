(function () {
  const ASSET_TYPES = [
    { key: 'gold_18k', name: 'طلای ۱۸ عیار', icon: '🥇' },
    { key: 'gold_24k', name: 'طلای ۲۴ عیار', icon: '🏅' },
    { key: 'gold_melted', name: 'طلای آب‌شده', icon: '🥇' },
    { key: 'coin_emami', name: 'سکه امامی', icon: '🪙' },
    { key: 'coin_bahar', name: 'سکه بهار آزادی', icon: '🪙' },
    { key: 'coin_half', name: 'نیم سکه', icon: '🪙' },
    { key: 'coin_quarter', name: 'ربع سکه', icon: '🪙' },
    { key: 'coin_1gr', name: 'سکه یک گرمی', icon: '🪙' },
    { key: 'usd', name: 'دلار آمریکا', icon: '💵' },
    { key: 'eur', name: 'یورو', icon: '💶' },
    { key: 'bitcoin', name: 'بیتکوین', icon: '₿' },
    { key: 'ethereum', name: 'اتریوم', icon: '⟠' },
    { key: 'tether', name: 'تتر', icon: '₮' },
    { key: 'gold_ounce', name: 'انس طلا', icon: '🏆' },
    { key: 'property', name: 'ملک و مسکن', icon: '🏠' },
    { key: 'car', name: 'خودرو', icon: '🚗' },
    { key: 'cash_toman', name: 'پول نقد (تومان)', icon: '💰' },
    { key: 'bank_deposit', name: 'سپرده بانکی', icon: '🏦' },
    { key: 'stocks', name: 'سهام بورس', icon: '📈' },
    { key: 'fund', name: 'صندوق سرمایه‌گذاری', icon: '📊' },
    { key: 'other', name: 'سایر دارایی‌ها', icon: '📦' },
  ];

  let recommendations = [];
  let filter = 'all';
  let editingId = null;

  const tbody = document.getElementById('rec-tbody');
  const modal = document.getElementById('rec-modal');
  const statsModal = document.getElementById('stats-modal');
  const form = document.getElementById('rec-form');
  const titleInput = document.getElementById('rec-title');
  const bodyInput = document.getElementById('rec-body');
  const assetSelect = document.getElementById('rec-asset');
  const targetInput = document.getElementById('rec-target');
  const expiresInput = document.getElementById('rec-expires');
  const noExpireCheck = document.getElementById('rec-no-expire');
  const previewTitle = document.getElementById('preview-title');
  const previewBody = document.getElementById('preview-body');
  const titleCounter = document.getElementById('title-counter');
  const bodyCounter = document.getElementById('body-counter');

  ASSET_TYPES.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a.key;
    opt.textContent = `${a.icon} ${a.name}`;
    assetSelect.appendChild(opt);
  });

  const TYPE_MAP = { action: ['اقدام', 'green'], alert: ['هشدار', 'blue'] };
  const PRIORITY_MAP = {
    urgent: ['فوری', 'red'],
    high: ['مهم', 'amber'],
    medium: ['متوسط', 'gray'],
    low: ['کم', 'light-gray'],
  };

  function isExpired(rec) {
    if (!rec.expires_at) return false;
    return new Date(rec.expires_at) < new Date();
  }

  function recStatus(rec) {
    if (!rec.is_active) return ['غیرفعال', 'red'];
    if (isExpired(rec)) return ['منقضی', 'gray'];
    return ['فعال', 'green'];
  }

  function filterList(list) {
    return list.filter((r) => {
      if (filter === 'action') return r.type === 'action';
      if (filter === 'alert') return r.type === 'alert';
      if (filter === 'active') return r.is_active && !isExpired(r);
      if (filter === 'expired') return isExpired(r);
      return true;
    });
  }

  function updatePreview() {
    previewTitle.textContent = titleInput.value.trim() || 'عنوان پیشنهاد';
    previewBody.textContent = bodyInput.value.trim() || 'متن پیشنهاد اینجا نمایش داده می‌شود...';
    titleCounter.textContent = `${AdminAPI.pd(titleInput.value.length)}/۸۰`;
    bodyCounter.textContent = `${AdminAPI.pd(bodyInput.value.length)}/۱۰۰۰`;
  }

  titleInput.addEventListener('input', updatePreview);
  bodyInput.addEventListener('input', updatePreview);

  noExpireCheck.addEventListener('change', async () => {
    if (noExpireCheck.checked) {
      AdminDatePicker.destroy(expiresInput);
      expiresInput.disabled = true;
      expiresInput.value = '';
    } else {
      expiresInput.disabled = false;
      await AdminDatePicker.init(expiresInput, {
        value: new Date(Date.now() + 30 * 86400000),
      });
    }
  });

  document.querySelectorAll('.admin-filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.admin-filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      filter = pill.dataset.filter;
      renderTable();
    });
  });

  function renderTable() {
    const rows = filterList(recommendations);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-empty-msg">پیشنهادی یافت نشد</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const [typeLabel, typeCls] = TYPE_MAP[r.type] || [r.type, 'gray'];
      const [priLabel, priCls] = PRIORITY_MAP[r.priority] || [r.priority, 'gray'];
      const [stLabel, stCls] = recStatus(r);
      const stats = r.stats || { pending: 0, done: 0, dismissed: 0 };
      const assetLabel = r.asset_name || (r.asset_key ? ASSET_TYPES.find((a) => a.key === r.asset_key)?.name : '—');

      return `
        <tr>
          <td>${r.title}</td>
          <td><span class="admin-badge ${typeCls}">${typeLabel}</span></td>
          <td><span class="admin-badge ${priCls}">${priLabel}</span></td>
          <td>${assetLabel || '—'}</td>
          <td><span class="admin-badge ${stCls}">${stLabel}</span></td>
          <td>${r.expires_at ? AdminAPI.formatDateTime(r.expires_at) : 'بدون انقضا'}</td>
          <td>
            <div class="admin-rec-stats" data-stats-id="${r.id}" title="مشاهده آمار">
              <span class="admin-rec-stat-pill pending">${AdminAPI.pd(stats.pending)} در انتظار</span>
              <span class="admin-rec-stat-pill done">${AdminAPI.pd(stats.done)} انجام شد</span>
              <span class="admin-rec-stat-pill dismissed">${AdminAPI.pd(stats.dismissed)} رد شد</span>
            </div>
          </td>
          <td>
            <button type="button" class="admin-btn secondary sm" data-edit="${r.id}">ویرایش</button>
            <button type="button" class="admin-btn secondary sm" data-toggle="${r.id}">${r.is_active ? 'غیرفعال' : 'فعال'}</button>
            <button type="button" class="admin-btn danger sm" data-delete="${r.id}">حذف</button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-edit'));
        if (Number.isFinite(id)) openEdit(id);
      });
    });
    tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-toggle'));
        if (Number.isFinite(id)) toggleActive(id);
      });
    });
    tbody.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-delete'));
        if (Number.isFinite(id)) deleteRec(id);
      });
    });
    tbody.querySelectorAll('[data-stats-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = Number(el.getAttribute('data-stats-id'));
        if (Number.isFinite(id)) openStats(id);
      });
    });
  }

  async function setupExpiresPicker(isoValue) {
    AdminDatePicker.destroy(expiresInput);
    if (noExpireCheck.checked) {
      expiresInput.disabled = true;
      expiresInput.value = '';
      return;
    }
    expiresInput.disabled = false;
    await AdminDatePicker.init(expiresInput, {
      value: isoValue || new Date(Date.now() + 30 * 86400000),
    });
  }

  function openCreate() {
    editingId = null;
    document.getElementById('rec-modal-title').textContent = 'پیشنهاد جدید';
    form.reset();
    const typeAction = form.querySelector('input[name="type"][value="action"]');
    const priorityMedium = form.querySelector('input[name="priority"][value="medium"]');
    if (typeAction) typeAction.checked = true;
    if (priorityMedium) priorityMedium.checked = true;
    noExpireCheck.checked = true;
    expiresInput.disabled = true;
    expiresInput.value = '';
    updatePreview();
    adminOpenModal('rec-modal');
    setupExpiresPicker(null);
  }

  function openEdit(id) {
    const r = recommendations.find((x) => Number(x.id) === Number(id));
    if (!r) {
      AdminAPI.showToast('پیشنهاد یافت نشد', 'error');
      return;
    }
    editingId = id;
    document.getElementById('rec-modal-title').textContent = 'ویرایش پیشنهاد';
    titleInput.value = r.title;
    bodyInput.value = r.body;
    form.querySelector(`input[name="type"][value="${r.type}"]`).checked = true;
    form.querySelector(`input[name="priority"][value="${r.priority}"]`).checked = true;
    assetSelect.value = r.asset_key || '';
    targetInput.value = r.target_percent != null ? r.target_percent : '';
    if (r.expires_at) {
      noExpireCheck.checked = false;
      expiresInput.disabled = false;
    } else {
      noExpireCheck.checked = true;
      expiresInput.disabled = true;
      expiresInput.value = '';
    }
    updatePreview();
    adminOpenModal('rec-modal');
    setupExpiresPicker(r.expires_at || null);
  }

  function closeModal() {
    adminCloseModal('rec-modal');
    editingId = null;
  }

  function pieSvg(stats) {
    const total = stats.pending + stats.done + stats.dismissed || 1;
    const parts = [
      { v: stats.pending, color: '#F59E0B' },
      { v: stats.done, color: '#10B981' },
      { v: stats.dismissed, color: '#94A3B8' },
    ];
    let offset = 0;
    const r = 40;
    const cx = 50;
    const cy = 50;
    let paths = '';
    parts.forEach((p) => {
      const frac = p.v / total;
      const angle = frac * 360;
      if (frac <= 0) return;
      const a1 = (offset - 90) * Math.PI / 180;
      const a2 = (offset + angle - 90) * Math.PI / 180;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy + r * Math.sin(a2);
      const large = angle > 180 ? 1 : 0;
      paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${p.color}"/>`;
      offset += angle;
    });
    return `<svg width="100" height="100" viewBox="0 0 100 100">${paths || `<circle cx="50" cy="50" r="40" fill="#E2E8F0"/>`}</svg>`;
  }

  async function openStats(id) {
    try {
      const data = await AdminAPI.get(`/api/admin/expert/recommendations/${id}/stats`);
      const s = data.stats || {};
      document.getElementById('stats-pie').innerHTML = pieSvg(s);
      document.getElementById('stats-legend').innerHTML = `
        <div>در انتظار: ${AdminAPI.pd(s.pending || 0)}</div>
        <div>انجام شد: ${AdminAPI.pd(s.done || 0)}</div>
        <div>رد شد: ${AdminAPI.pd(s.dismissed || 0)}</div>`;
      const list = data.done_users || [];
      document.getElementById('stats-done-list').innerHTML = list.length
        ? list.map((u) => `<div>${u.name} — ${AdminAPI.formatDate(u.updated_at)}</div>`).join('')
        : '<div class="admin-form-hint">هنوز کاربری «انجام شد» ثبت نکرده</div>';
      adminOpenModal('stats-modal');
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function load() {
    try {
      const data = await AdminAPI.get('/api/admin/expert/recommendations?limit=100');
      recommendations = data.recommendations || [];
      renderTable();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا در بارگذاری', 'error');
    }
  }

  async function toggleActive(id) {
    const r = recommendations.find((x) => x.id === id);
    if (!r) return;
    try {
      await AdminAPI.patch(`/api/admin/expert/recommendations/${id}`, { is_active: r.is_active ? 0 : 1 });
      AdminAPI.showToast('وضعیت بروزرسانی شد');
      await load();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function deleteRec(id) {
    if (!await AdminAPI.confirm('این پیشنهاد حذف شود؟', { danger: true, confirmLabel: 'حذف' })) return;
    try {
      await AdminAPI.delete(`/api/admin/expert/recommendations/${id}`);
      AdminAPI.showToast('پیشنهاد حذف شد');
      await load();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!noExpireCheck.checked && !AdminDatePicker.getIso(expiresInput)) {
      AdminAPI.showToast('تاریخ انقضا را انتخاب کنید', 'error');
      return;
    }
    const assetKey = assetSelect.value || null;
    const asset = ASSET_TYPES.find((a) => a.key === assetKey);
    const payload = {
      title: titleInput.value.trim(),
      body: bodyInput.value.trim(),
      type: form.querySelector('input[name="type"]:checked').value,
      priority: form.querySelector('input[name="priority"]:checked').value,
      asset_key: assetKey,
      asset_name: asset ? asset.name : null,
      target_percent: targetInput.value !== '' ? Number(targetInput.value) : null,
      expires_at: noExpireCheck.checked ? null : AdminDatePicker.getIso(expiresInput),
    };

    try {
      if (editingId) {
        await AdminAPI.patch(`/api/admin/expert/recommendations/${editingId}`, payload);
        AdminAPI.showToast('پیشنهاد بروزرسانی شد');
      } else {
        const subData = await AdminAPI.get('/api/admin/expert/recommendations/subscriber-count');
        const count = subData.count || 0;
        AdminAPI.showToast(`در حال ارسال نوتیفیکیشن به ${AdminAPI.pd(count)} کاربر...`);
        await AdminAPI.post('/api/admin/expert/recommendations', payload);
        AdminAPI.showToast('پیشنهاد ایجاد و ارسال شد');
      }
      closeModal();
      await load();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  });

  document.getElementById('btn-new-rec')?.addEventListener('click', openCreate);
  document.getElementById('rec-modal-close').addEventListener('click', closeModal);
  document.getElementById('rec-modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.getElementById('stats-modal-close').addEventListener('click', () => adminCloseModal('stats-modal'));
  statsModal.addEventListener('click', (e) => { if (e.target === statsModal) adminCloseModal('stats-modal'); });

  load();
})();
