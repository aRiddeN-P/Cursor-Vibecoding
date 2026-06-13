(function () {
  'use strict';

  const VERIF_LABELS = ['پایه', 'سطح ۱', 'سطح ۲', 'سطح ۳'];
  const VERIF_BADGE = ['gray', 'blue', 'amber', 'green'];
  const PLAN_NAMES = { silver: 'نقره‌ای', gold: 'طلایی', diamond: 'الماسی' };
  const PLAN_BADGE = { silver: 'gray', gold: 'gold', diamond: 'blue' };

  const state = {
    tab: 'users',
    usersPage: 1,
    verifPage: 1,
    subPage: 1,
    verifSelected: new Set(),
    subSelected: new Set(),
    rejectContext: null,
    searchTimer: null,
  };

  function fmt(n) {
    return AdminAPI.pd(Number(n || 0).toLocaleString('en'));
  }

  function displayName(u) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
    return name || u.mobile || '—';
  }

  function subscriptionBadge(u) {
    if (!u.subscription_plan) return { cls: 'gray', text: 'بدون' };
    if (u.is_subscription_active === false && u.subscription_expires_at) {
      return { cls: 'red', text: 'منقضی' };
    }
    if (u.is_subscription_active === false && !u.subscription_expires_at) {
      return { cls: 'gray', text: 'بدون' };
    }
    const plan = u.subscription_plan;
    return { cls: PLAN_BADGE[plan] || 'gray', text: PLAN_NAMES[plan] || plan };
  }

  function statusBadge(status) {
    const map = {
      pending: ['amber', 'در انتظار'],
      approved: ['green', 'تایید شده'],
      rejected: ['red', 'رد شده'],
    };
    const [cls, text] = map[status] || ['gray', status];
    return `<span class="admin-badge ${cls}">${text}</span>`;
  }

  function getTabFromUrl() {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return ['users', 'verification', 'subscription'].includes(tab) ? tab : 'users';
  }

  function setTab(tab, pushUrl) {
    state.tab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.admin-tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${tab}`);
    });
    if (pushUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      history.replaceState(null, '', url.pathname + url.search);
    }
    if (tab === 'users') loadUsers();
    if (tab === 'verification') loadVerifications();
    if (tab === 'subscription') loadSubscriptions();
  }

  function openModal(id) {
    adminOpenModal(id);
  }

  function closeModal(id) {
    adminCloseModal(id);
  }

  function closeAllModals() {
    adminCloseAllModals();
    state.rejectContext = null;
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeAllModals();
    });
  });

  function renderPagination(containerId, pagination, onPage) {
    const el = document.getElementById(containerId);
    if (!el || !pagination) return;
    const { page, total_pages, total } = pagination;
    if (total_pages <= 1) {
      el.innerHTML = total ? `<span>${fmt(total)} مورد</span>` : '';
      return;
    }
    el.innerHTML = `
      <button type="button" class="admin-btn secondary sm" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">قبلی</button>
      <span>صفحه ${AdminAPI.pd(page)} از ${AdminAPI.pd(total_pages)}</span>
      <button type="button" class="admin-btn secondary sm" ${page >= total_pages ? 'disabled' : ''} data-page="${page + 1}">بعدی</button>
    `;
    el.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => onPage(Number(btn.dataset.page)));
    });
  }

  async function loadUsers(page = state.usersPage) {
    state.usersPage = page;
    const params = new URLSearchParams({
      page,
      limit: 20,
      sort: document.getElementById('filter-sort')?.value || 'newest',
    });
    const search = document.getElementById('filter-search')?.value.trim();
    const verif = document.getElementById('filter-verif')?.value;
    const sub = document.getElementById('filter-sub')?.value;
    if (search) params.set('search', search);
    if (verif !== '') params.set('verification_level', verif);
    if (sub) params.set('subscription_plan', sub);

    try {
      const data = await AdminAPI.get(`/api/admin/users?${params}`);
      const tbody = document.getElementById('users-tbody');
      if (!data.users.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty-msg">کاربری یافت نشد</td></tr>';
      } else {
        tbody.innerHTML = data.users.map(u => {
          const subB = subscriptionBadge(u);
          const pending = (u.pending_verification || u.pending_subscription)
            ? '<span class="admin-pending-dot" title="درخواست در انتظار">🔔</span>' : '';
          return `
            <tr>
              <td>${AdminAPI.pd(u.id)}</td>
              <td>${displayName(u)}${pending}</td>
              <td dir="ltr">${u.mobile}</td>
              <td><span class="admin-badge ${VERIF_BADGE[u.verification_level] || 'gray'}">${VERIF_LABELS[u.verification_level] || '—'}</span></td>
              <td><span class="admin-badge ${subB.cls}">${subB.text}</span></td>
              <td>${AdminAPI.formatDate(u.created_at)}</td>
              <td><button type="button" class="admin-btn secondary sm btn-view-user" data-id="${u.id}">مشاهده</button></td>
            </tr>
          `;
        }).join('');
        tbody.querySelectorAll('.btn-view-user').forEach(btn => {
          btn.addEventListener('click', () => openUserDetail(Number(btn.dataset.id)));
        });
      }
      renderPagination('users-pagination', data.pagination, loadUsers);
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function loadVerifications(page = state.verifPage) {
    state.verifPage = page;
    state.verifSelected.clear();
    updateBulkVerifBar();
    try {
      const data = await AdminAPI.get(`/api/admin/verification/requests?page=${page}&limit=20&status=pending`);
      const tbody = document.getElementById('verif-tbody');
      const badge = document.getElementById('badge-verif');
      if (badge) {
        badge.textContent = AdminAPI.pd(data.pagination?.total || 0);
        badge.classList.toggle('hidden', !(data.pagination?.total > 0));
      }
      if (!data.requests.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-empty-msg">درخواستی در انتظار نیست</td></tr>';
      } else {
        tbody.innerHTML = data.requests.map(r => `
          <tr>
            <td><input type="checkbox" class="verif-check" data-id="${r.id}" ${r.status !== 'pending' ? 'disabled' : ''} /></td>
            <td>${displayName(r.user)}</td>
            <td dir="ltr">${r.user.mobile}</td>
            <td>${VERIF_LABELS[r.user.verification_level] || '—'}</td>
            <td>${VERIF_LABELS[r.requested_level] || AdminAPI.pd(r.requested_level)}</td>
            <td>${AdminAPI.formatDate(r.created_at)}</td>
            <td>${statusBadge(r.status)}</td>
            <td class="admin-request-row-actions">
              ${r.status === 'pending' ? `
                <button type="button" class="admin-btn success sm btn-verif-approve" data-id="${r.id}">تایید</button>
                <button type="button" class="admin-btn danger sm btn-verif-reject" data-id="${r.id}">رد</button>
              ` : '—'}
            </td>
          </tr>
        `).join('');

        tbody.querySelectorAll('.verif-check').forEach(cb => {
          cb.addEventListener('change', () => {
            if (cb.checked) state.verifSelected.add(Number(cb.dataset.id));
            else state.verifSelected.delete(Number(cb.dataset.id));
            updateBulkVerifBar();
          });
        });
        tbody.querySelectorAll('.btn-verif-approve').forEach(btn => {
          btn.addEventListener('click', () => patchVerif(Number(btn.dataset.id), 'approve'));
        });
        tbody.querySelectorAll('.btn-verif-reject').forEach(btn => {
          btn.addEventListener('click', () => openRejectModal('verification', Number(btn.dataset.id)));
        });
      }
      renderPagination('verif-pagination', data.pagination, loadVerifications);
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function loadSubscriptions(page = state.subPage) {
    state.subPage = page;
    state.subSelected.clear();
    updateBulkSubBar();
    try {
      const data = await AdminAPI.get(`/api/admin/subscription/requests?page=${page}&limit=20&status=pending`);
      const tbody = document.getElementById('sub-tbody');
      const badge = document.getElementById('badge-sub');
      if (badge) {
        badge.textContent = AdminAPI.pd(data.pagination?.total || 0);
        badge.classList.toggle('hidden', !(data.pagination?.total > 0));
      }
      if (!data.requests.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="admin-empty-msg">درخواستی در انتظار نیست</td></tr>';
      } else {
        tbody.innerHTML = data.requests.map(r => {
          const discount = r.final_price != null && r.final_price < r.price
            ? fmt(r.price - r.final_price) : '—';
          return `
            <tr>
              <td><input type="checkbox" class="sub-check" data-id="${r.id}" ${r.status !== 'pending' ? 'disabled' : ''} /></td>
              <td>${displayName(r.user)}</td>
              <td dir="ltr">${r.user.mobile}</td>
              <td>${PLAN_NAMES[r.plan] || r.plan}</td>
              <td>${fmt(r.price)}</td>
              <td>${discount}</td>
              <td>${fmt(r.final_price ?? r.price)}</td>
              <td>${AdminAPI.formatDate(r.created_at)}</td>
              <td>${statusBadge(r.status)}</td>
              <td class="admin-request-row-actions">
                ${r.status === 'pending' ? `
                  <button type="button" class="admin-btn success sm btn-sub-approve" data-id="${r.id}">تایید</button>
                  <button type="button" class="admin-btn danger sm btn-sub-reject" data-id="${r.id}">رد</button>
                ` : '—'}
              </td>
            </tr>
          `;
        }).join('');

        tbody.querySelectorAll('.sub-check').forEach(cb => {
          cb.addEventListener('change', () => {
            if (cb.checked) state.subSelected.add(Number(cb.dataset.id));
            else state.subSelected.delete(Number(cb.dataset.id));
            updateBulkSubBar();
          });
        });
        tbody.querySelectorAll('.btn-sub-approve').forEach(btn => {
          btn.addEventListener('click', () => patchSub(Number(btn.dataset.id), 'approve'));
        });
        tbody.querySelectorAll('.btn-sub-reject').forEach(btn => {
          btn.addEventListener('click', () => openRejectModal('subscription', Number(btn.dataset.id)));
        });
      }
      renderPagination('sub-pagination', data.pagination, loadSubscriptions);
    } catch (err) {
      AdminAPI.showToast(err.message || 'error');
    }
  }

  function updateBulkVerifBar() {
    const bar = document.getElementById('bulk-verif-bar');
    const count = document.getElementById('bulk-verif-count');
    if (bar) bar.classList.toggle('visible', state.verifSelected.size > 0);
    if (count) count.textContent = `${AdminAPI.pd(state.verifSelected.size)} مورد انتخاب شده`;
  }

  function updateBulkSubBar() {
    const bar = document.getElementById('bulk-sub-bar');
    const count = document.getElementById('bulk-sub-count');
    if (bar) bar.classList.toggle('visible', state.subSelected.size > 0);
    if (count) count.textContent = `${AdminAPI.pd(state.subSelected.size)} مورد انتخاب شده`;
  }

  async function patchVerif(id, action, admin_note) {
    await AdminAPI.patch(`/api/admin/verification/requests/${id}`, { action, admin_note });
  }

  async function patchSub(id, action, admin_note) {
    await AdminAPI.patch(`/api/admin/subscription/requests/${id}`, { action, admin_note });
  }

  function openRejectModal(type, id) {
    state.rejectContext = { type, ids: [id], bulk: false };
    document.getElementById('reject-note').value = '';
    document.getElementById('reject-modal-title').textContent = 'رد درخواست';
    openModal('reject-modal');
  }

  document.getElementById('btn-confirm-reject')?.addEventListener('click', async () => {
    const note = document.getElementById('reject-note').value.trim() || undefined;
    const ctx = state.rejectContext;
    if (!ctx) return;
    closeModal('reject-modal');
    try {
      if (ctx.bulk) {
        await processBulk(ctx.type, ctx.ids, 'reject', note);
      } else {
        if (ctx.type === 'verification') await patchVerif(ctx.ids[0], 'reject', note);
        else await patchSub(ctx.ids[0], 'reject', note);
        AdminAPI.showToast('درخواست رد شد');
        if (ctx.type === 'verification') loadVerifications();
        else loadSubscriptions();
        refreshBadges();
      }
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  });

  async function processBulk(type, ids, action, note) {
    const total = ids.length;
    for (let i = 0; i < total; i++) {
      AdminAPI.showToast(`${AdminAPI.pd(i + 1)} از ${AdminAPI.pd(total)} پردازش شد...`);
      try {
        if (type === 'verification') await patchVerif(ids[i], action, note);
        else await patchSub(ids[i], action, note);
      } catch (err) {
        AdminAPI.showToast(err.message || `خطا در مورد ${i + 1}`, 'error');
      }
    }
    AdminAPI.showToast('پردازش گروهی انجام شد');
    if (type === 'verification') loadVerifications();
    else loadSubscriptions();
    refreshBadges();
  }

  document.getElementById('bulk-verif-approve')?.addEventListener('click', async () => {
    const ids = [...state.verifSelected];
    if (!ids.length) return;
    await processBulk('verification', ids, 'approve');
  });

  document.getElementById('bulk-verif-reject')?.addEventListener('click', () => {
    const ids = [...state.verifSelected];
    if (!ids.length) return;
    state.rejectContext = { type: 'verification', ids, bulk: true };
    document.getElementById('reject-note').value = '';
    openModal('reject-modal');
  });

  document.getElementById('bulk-sub-approve')?.addEventListener('click', async () => {
    const ids = [...state.subSelected];
    if (!ids.length) return;
    await processBulk('subscription', ids, 'approve');
  });

  document.getElementById('bulk-sub-reject')?.addEventListener('click', () => {
    const ids = [...state.subSelected];
    if (!ids.length) return;
    state.rejectContext = { type: 'subscription', ids, bulk: true };
    document.getElementById('reject-note').value = '';
    openModal('reject-modal');
  });

  document.getElementById('verif-select-all')?.addEventListener('change', e => {
    document.querySelectorAll('.verif-check:not(:disabled)').forEach(cb => {
      cb.checked = e.target.checked;
      const id = Number(cb.dataset.id);
      if (e.target.checked) state.verifSelected.add(id);
      else state.verifSelected.delete(id);
    });
    updateBulkVerifBar();
  });

  document.getElementById('sub-select-all')?.addEventListener('change', e => {
    document.querySelectorAll('.sub-check:not(:disabled)').forEach(cb => {
      cb.checked = e.target.checked;
      const id = Number(cb.dataset.id);
      if (e.target.checked) state.subSelected.add(id);
      else state.subSelected.delete(id);
    });
    updateBulkSubBar();
  });

  async function openUserDetail(userId) {
    openModal('user-detail-modal');
    const body = document.getElementById('user-detail-body');
    body.innerHTML = '<p class="admin-empty-msg">در حال بارگذاری...</p>';
    try {
      const data = await AdminAPI.get(`/api/admin/users/${userId}`);
      body.innerHTML = renderUserDetail(data);
      body.querySelector('#btn-reset-stories')?.addEventListener('click', async () => {
        await AdminAPI.patch(`/api/admin/users/${userId}/reset-stories`, {});
        AdminAPI.showToast('استوری ریست شد');
      });
      body.querySelectorAll('.btn-detail-verif-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
          await patchVerif(Number(btn.dataset.id), 'approve');
          AdminAPI.showToast('تایید شد');
          openUserDetail(userId);
        });
      });
      body.querySelectorAll('.btn-detail-verif-reject').forEach(btn => {
        btn.addEventListener('click', () => {
          closeModal('user-detail-modal');
          openRejectModal('verification', Number(btn.dataset.id));
        });
      });
      body.querySelectorAll('.btn-detail-sub-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
          await patchSub(Number(btn.dataset.id), 'approve');
          AdminAPI.showToast('تایید شد');
          openUserDetail(userId);
        });
      });
      body.querySelectorAll('.btn-detail-sub-reject').forEach(btn => {
        btn.addEventListener('click', () => {
          closeModal('user-detail-modal');
          openRejectModal('subscription', Number(btn.dataset.id));
        });
      });
    } catch (err) {
      body.innerHTML = `<p class="admin-empty-msg">${err.message || 'خطا'}</p>`;
    }
  }

  function renderUserDetail(data) {
    const u = data.user;
    const e = data.engagement || {};
    const subB = subscriptionBadge(u);
    const initials = displayName(u).slice(0, 1);

    const lastSeen = e.last_seen ? AdminAPI.formatDate(e.last_seen) : '—';
    const avgMinutes = e.avg_session_minutes != null
      ? AdminAPI.pd(Number(e.avg_session_minutes).toLocaleString('en', { maximumFractionDigits: 1 }))
      : '۰';

    const statsHtml = `
      <div class="admin-stats-grid">
        <div class="admin-stat-cell"><div class="val">${lastSeen}</div><div class="lbl">آخرین بازدید</div></div>
        <div class="admin-stat-cell"><div class="val">${fmt(e.session_count || 0)}</div><div class="lbl">تعداد نشست</div></div>
        <div class="admin-stat-cell"><div class="val">${avgMinutes}</div><div class="lbl">میانگین حضور (دقیقه)</div></div>
        <div class="admin-stat-cell"><div class="val">${fmt(e.device_count || 0)}</div><div class="lbl">دستگاه‌های متصل</div></div>
      </div>
    `;

    const verifList = (data.verification_requests || []).map(r => `
      <div class="admin-request-item">
        <span>سطح ${AdminAPI.pd(r.requested_level)} — ${statusBadge(r.status)} — ${AdminAPI.formatDate(r.created_at)}</span>
        ${r.status === 'pending' ? `
          <span class="admin-request-row-actions">
            <button type="button" class="admin-btn success sm btn-detail-verif-approve" data-id="${r.id}">تایید</button>
            <button type="button" class="admin-btn danger sm btn-detail-verif-reject" data-id="${r.id}">رد</button>
          </span>
        ` : ''}
      </div>
    `).join('') || '<p class="admin-empty-msg">درخواستی ثبت نشده</p>';

    const subList = (data.subscription_requests || []).map(r => `
      <div class="admin-request-item">
        <span>${PLAN_NAMES[r.plan] || r.plan} — ${statusBadge(r.status)} — ${AdminAPI.formatDate(r.created_at)}</span>
        ${r.status === 'pending' ? `
          <span class="admin-request-row-actions">
            <button type="button" class="admin-btn success sm btn-detail-sub-approve" data-id="${r.id}">تایید</button>
            <button type="button" class="admin-btn danger sm btn-detail-sub-reject" data-id="${r.id}">رد</button>
          </span>
        ` : ''}
      </div>
    `).join('') || '<p class="admin-empty-msg">درخواستی ثبت نشده</p>';

    const devices = (data.devices || []).map(d => `
      <div class="admin-device-item">${d.device_name} (${d.device_type}) — ${AdminAPI.formatDate(d.last_active)}</div>
    `).join('') || '<p class="admin-empty-msg">دستگاهی ثبت نشده</p>';

    const ref = data.referrals || {};
    const expiry = u.subscription_expires_at
      ? AdminAPI.formatDate(u.subscription_expires_at) : '—';

    return `
      <div class="admin-user-detail-header">
        <div class="admin-user-avatar">
          ${u.avatar_url ? `<img src="${u.avatar_url}" alt="" />` : initials}
        </div>
        <div class="admin-user-info">
          <div class="admin-user-name">${displayName(u)}</div>
          <div class="admin-user-mobile">${u.mobile}</div>
          <div class="admin-user-badges">
            <span class="admin-badge ${VERIF_BADGE[u.verification_level] || 'gray'}">${VERIF_LABELS[u.verification_level]}</span>
            <span class="admin-badge ${subB.cls}">${subB.text}</span>
            ${u.is_subscription_active ? `<span class="admin-badge blue">تا ${expiry}</span>` : ''}
          </div>
        </div>
        <button type="button" class="admin-btn warning sm" id="btn-reset-stories">ریست استوری</button>
      </div>

      <div class="admin-detail-section">
        <div class="admin-detail-section-title">فعالیت در اپ</div>
        ${statsHtml}
      </div>

      <div class="admin-detail-section">
        <div class="admin-detail-section-title">مشخصات</div>
        <table class="admin-detail-kv">
          <tr><td>ایمیل</td><td dir="ltr">${u.email || '—'}</td></tr>
          <tr><td>کد ملی</td><td>${u.national_id ? AdminAPI.pd(u.national_id) : '—'}</td></tr>
          <tr><td>تاریخ تولد</td><td>${u.birth_date ? AdminAPI.formatDate(u.birth_date) : '—'}</td></tr>
          <tr><td>آدرس</td><td>${u.address || '—'}</td></tr>
          <tr><td>کدپستی</td><td>${u.postal_code ? AdminAPI.pd(u.postal_code) : '—'}</td></tr>
        </table>
      </div>

      <div class="admin-detail-section">
        <div class="admin-detail-section-title">درخواست‌های احراز</div>
        ${verifList}
      </div>

      <div class="admin-detail-section">
        <div class="admin-detail-section-title">درخواست‌های اشتراک</div>
        ${subList}
      </div>

      <div class="admin-detail-section">
        <div class="admin-detail-section-title">دستگاه‌های متصل</div>
        ${devices}
      </div>

      <div class="admin-detail-section">
        <div class="admin-detail-section-title">معرفی‌گری</div>
        <p style="font-size:13px;color:var(--admin-text-2);">
          دعوت‌کننده: ${ref.invited_by ? ref.invited_by.mobile : '—'}<br />
          تعداد دعوت‌شدگان: ${fmt(ref.invited_count || 0)} نفر
          ${ref.successful_referrals ? ` (${fmt(ref.successful_referrals)} موفق)` : ''}
        </p>
      </div>
    `;
  }

  async function quickSearch() {
    const mobile = AdminAPI.normalizeDigits(document.getElementById('quick-mobile')?.value.trim());
    if (!mobile) return;
    try {
      const data = await AdminAPI.get(`/api/admin/users/search?mobile=${encodeURIComponent(mobile)}`);
      if (!data.users.length) {
        AdminAPI.showToast('کاربری یافت نشد', 'error');
        return;
      }
      if (data.users.length === 1) {
        openUserDetail(data.users[0].id);
      } else {
        document.getElementById('filter-search').value = mobile;
        setTab('users', true);
        loadUsers(1);
      }
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function refreshBadges() {
    try {
      const overview = await AdminAPI.get('/api/admin/stats/overview');
      const vBadge = document.getElementById('badge-verif');
      const sBadge = document.getElementById('badge-sub');
      const vp = overview.verification?.pending_requests || 0;
      const sp = overview.subscriptions?.pending_requests || 0;
      if (vBadge) {
        vBadge.textContent = AdminAPI.pd(vp);
        vBadge.classList.toggle('hidden', vp === 0);
      }
      if (sBadge) {
        sBadge.textContent = AdminAPI.pd(sp);
        sBadge.classList.toggle('hidden', sp === 0);
      }
    } catch (_) { /* ignore */ }
  }

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab, true));
  });

  document.getElementById('btn-quick-search')?.addEventListener('click', quickSearch);
  document.getElementById('quick-mobile')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') quickSearch();
  });

  ['filter-search'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => loadUsers(1), 400);
    });
  });

  ['filter-verif', 'filter-sub', 'filter-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => loadUsers(1));
  });

  initAdminLayout('users');
  closeAllModals();
  setTab(getTabFromUrl(), false);
  refreshBadges();
})();
