(function () {
  const SWATCHES = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
    '#8B5CF6', '#EC4899', '#F97316', '#6366F1',
    '#0EA5E9', '#84CC16', '#9CA3AF', '#1A5C3A',
  ];

  const TYPE_LABELS = { expense: 'هزینه', income: 'درآمد', both: 'هر دو' };
  const STATUS_LABELS = {
    pending: ['در انتظار', 'amber'],
    approved: ['تایید شده', 'green'],
    rejected: ['رد شده', 'red'],
  };

  let requests = [];
  let defaults = [];
  let reqFilter = 'all';
  let rejectId = null;
  let editingDefaultId = null;
  let selectedColor = SWATCHES[0];

  const reqTbody = document.getElementById('requests-tbody');
  const defTbody = document.getElementById('defaults-tbody');
  const rejectModal = document.getElementById('reject-modal');
  const defaultModal = document.getElementById('default-modal');
  const defaultForm = document.getElementById('default-form');
  const previewPill = document.getElementById('default-preview-pill');
  const swatchesEl = document.getElementById('color-swatches');
  const customColorInput = document.getElementById('custom-color');

  function userLabel(u) {
    if (!u) return '—';
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
    return name ? `${name} (${u.mobile})` : u.mobile;
  }

  function renderSwatches(selected) {
    swatchesEl.innerHTML = SWATCHES.map((c) =>
      `<button type="button" class="color-swatch${c === selected ? ' selected' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`
    ).join('');
    swatchesEl.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedColor = btn.dataset.color;
        customColorInput.value = selectedColor;
        renderSwatches(selectedColor);
        updatePreviewPill();
      });
    });
  }

  function updatePreviewPill() {
    const name = document.getElementById('def-name').value.trim() || 'نام دسته';
    const icon = document.getElementById('def-icon').value.trim() || '📁';
    previewPill.style.background = selectedColor;
    previewPill.textContent = `${icon} ${name}`;
  }

  document.getElementById('def-name').addEventListener('input', updatePreviewPill);
  document.getElementById('def-icon').addEventListener('input', updatePreviewPill);
  customColorInput.addEventListener('input', () => {
    selectedColor = customColorInput.value;
    renderSwatches(selectedColor);
    updatePreviewPill();
  });

  document.querySelectorAll('[data-req-filter]').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-req-filter]').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      reqFilter = pill.dataset.reqFilter;
      loadRequests();
    });
  });

  function filterRequests() {
    if (reqFilter === 'all') return requests;
    return requests.filter((r) => r.status === reqFilter);
  }

  function renderRequests() {
    const rows = filterRequests();
    if (!rows.length) {
      reqTbody.innerHTML = `<tr><td colspan="8" class="admin-empty-msg">درخواستی یافت نشد</td></tr>`;
      return;
    }

    reqTbody.innerHTML = rows.map((r) => {
      const [stLabel, stCls] = STATUS_LABELS[r.status] || [r.status, 'gray'];
      const actions = r.status === 'pending'
        ? `<span class="admin-request-row-actions">
             <button type="button" class="admin-btn success sm" data-approve="${r.id}">تایید</button>
             <button type="button" class="admin-btn danger sm" data-reject="${r.id}">رد</button>
           </span>`
        : '—';

      return `
        <tr>
          <td>${userLabel(r.user)}</td>
          <td>
            <span class="category-preview-pill" style="background:${r.color}">${r.icon} ${r.name}</span>
          </td>
          <td>${r.icon}</td>
          <td><span class="category-color-dot" style="background:${r.color}"></span></td>
          <td>${TYPE_LABELS[r.type] || r.type}</td>
          <td>${AdminAPI.formatDate(r.created_at)}</td>
          <td><span class="admin-badge ${stCls}">${stLabel}</span></td>
          <td class="admin-table-actions">${actions}</td>
        </tr>`;
    }).join('');

    reqTbody.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => approveRequest(Number(btn.dataset.approve)));
    });
    reqTbody.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => openReject(Number(btn.dataset.reject)));
    });
  }

  function renderDefaults() {
    if (!defaults.length) {
      defTbody.innerHTML = `<tr><td colspan="6" class="admin-empty-msg">دسته پیش‌فرضی نیست</td></tr>`;
      return;
    }

    defTbody.innerHTML = defaults.map((c) => `
      <tr>
        <td>${c.icon}</td>
        <td>${c.name}</td>
        <td><span class="category-color-dot" style="background:${c.color}"></span></td>
        <td>${TYPE_LABELS[c.type] || c.type}</td>
        <td><span class="admin-badge ${c.is_active ? 'green' : 'red'}">${c.is_active ? 'فعال' : 'غیرفعال'}</span></td>
        <td class="admin-table-actions">
          <span class="admin-request-row-actions">
            <button type="button" class="admin-btn secondary sm" data-edit-def="${c.id}">ویرایش</button>
            <button type="button" class="admin-btn secondary sm" data-toggle-def="${c.id}">${c.is_active ? 'غیرفعال' : 'فعال'}</button>
          </span>
        </td>
      </tr>`).join('');

    defTbody.querySelectorAll('[data-edit-def]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-edit-def'));
        if (Number.isFinite(id)) openEditDefault(id);
      });
    });
    defTbody.querySelectorAll('[data-toggle-def]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-toggle-def'));
        if (Number.isFinite(id)) toggleDefault(id);
      });
    });
  }

  async function loadRequests() {
    try {
      const data = await AdminAPI.get(`/api/admin/categories/requests?status=${reqFilter === 'all' ? 'all' : reqFilter}&limit=100`);
      requests = data.requests || [];
      renderRequests();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function loadDefaults() {
    try {
      const data = await AdminAPI.get('/api/admin/categories/defaults');
      defaults = data.categories || [];
      renderDefaults();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function approveRequest(id) {
    if (!await AdminAPI.confirm('این دسته فقط برای کاربر درخواست‌کننده ایجاد شود؟', { confirmLabel: 'تایید' })) return;
    try {
      await AdminAPI.patch(`/api/admin/categories/requests/${id}`, { action: 'approve' });
      AdminAPI.showToast('درخواست تایید شد');
      await loadRequests();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  function openReject(id) {
    rejectId = id;
    document.getElementById('reject-note').value = '';
    adminOpenModal('reject-modal');
  }

  async function submitReject() {
    if (!rejectId) return;
    try {
      await AdminAPI.patch(`/api/admin/categories/requests/${rejectId}`, {
        action: 'reject',
        admin_note: document.getElementById('reject-note').value.trim(),
      });
      AdminAPI.showToast('درخواست رد شد');
      adminCloseModal('reject-modal');
      rejectId = null;
      await loadRequests();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  function openAddDefault() {
    editingDefaultId = null;
    document.getElementById('default-modal-title').textContent = 'افزودن دسته پیش‌فرض';
    defaultForm.reset();
    document.getElementById('def-type').disabled = false;
    document.getElementById('def-type').value = 'expense';
    selectedColor = SWATCHES[0];
    customColorInput.value = selectedColor;
    renderSwatches(selectedColor);
    updatePreviewPill();
    adminOpenModal('default-modal');
  }

  function openEditDefault(id) {
    const c = defaults.find((x) => Number(x.id) === Number(id));
    if (!c) {
      AdminAPI.showToast('دسته یافت نشد', 'error');
      return;
    }
    editingDefaultId = id;
    document.getElementById('default-modal-title').textContent = 'ویرایش دسته پیش‌فرض';
    document.getElementById('def-name').value = c.name;
    document.getElementById('def-icon').value = c.icon;
    document.getElementById('def-type').value = c.type;
    selectedColor = c.color;
    customColorInput.value = c.color;
    renderSwatches(selectedColor);
    updatePreviewPill();
    adminOpenModal('default-modal');
  }

  function closeDefaultModal() {
    adminCloseModal('default-modal');
    document.getElementById('def-type').disabled = false;
    editingDefaultId = null;
  }

  async function toggleDefault(id) {
    const c = defaults.find((x) => Number(x.id) === Number(id));
    if (!c) return;
    try {
      await AdminAPI.patch(`/api/admin/categories/defaults/${id}`, { is_active: c.is_active ? 0 : 1 });
      AdminAPI.showToast('وضعیت بروزرسانی شد');
      await loadDefaults();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  defaultForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('def-name').value.trim(),
      icon: document.getElementById('def-icon').value.trim() || '📁',
      color: selectedColor,
      type: document.getElementById('def-type').value,
    };
    try {
      if (editingDefaultId) {
        await AdminAPI.patch(`/api/admin/categories/defaults/${editingDefaultId}`, {
          name: payload.name,
          icon: payload.icon,
          color: payload.color,
          type: payload.type,
        });
        AdminAPI.showToast('دسته بروزرسانی شد');
      } else {
        await AdminAPI.post('/api/admin/categories/defaults', payload);
        AdminAPI.showToast('دسته پیش‌فرض اضافه شد');
      }
      closeDefaultModal();
      await loadDefaults();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  });

  document.getElementById('btn-add-default')?.addEventListener('click', openAddDefault);
  document.getElementById('default-modal-close').addEventListener('click', closeDefaultModal);
  document.getElementById('default-modal-cancel').addEventListener('click', closeDefaultModal);
  document.getElementById('reject-modal-close').addEventListener('click', () => adminCloseModal('reject-modal'));
  document.getElementById('reject-modal-cancel').addEventListener('click', () => adminCloseModal('reject-modal'));
  document.getElementById('reject-form').addEventListener('submit', (e) => { e.preventDefault(); submitReject(); });
  defaultModal.addEventListener('click', (e) => { if (e.target === defaultModal) closeDefaultModal(); });
  rejectModal.addEventListener('click', (e) => { if (e.target === rejectModal) adminCloseModal('reject-modal'); });

  renderSwatches(SWATCHES[0]);
  loadRequests();
  loadDefaults();
})();
