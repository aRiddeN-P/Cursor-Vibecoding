(function () {
  'use strict';

  const ACTION_ICONS = {
    login: '🔐',
    logout: '🚪',
    login_failed: '⚠️',
    change_password: '🔑',
    create_admin: '👤',
    update_admin: '✏️',
    delete_admin: '🗑️',
    approve_verification: '✅',
    reject_verification: '❌',
    approve_subscription: '💎',
    reject_subscription: '⛔',
  };

  const ACTION_LABELS = {
    login: 'ورود به پنل',
    logout: 'خروج از پنل',
    login_failed: 'تلاش ناموفق ورود',
    change_password: 'تغییر رمز عبور',
    create_admin: 'افزودن ادمین جدید',
    update_admin: 'ویرایش ادمین',
    delete_admin: 'حذف ادمین',
    approve_verification: 'تایید احراز هویت',
    reject_verification: 'رد احراز هویت',
    approve_subscription: 'تایید اشتراک',
    reject_subscription: 'رد اشتراک',
  };

  let page = 1;
  let adminFilter = '';
  const limit = 25;
  const listEl = document.getElementById('activity-log-list');
  const paginationEl = document.getElementById('history-pagination');
  const adminSelect = document.getElementById('history-admin-filter');

  function actionText(log) {
    let text = ACTION_LABELS[log.action] || log.action;
    if (log.target_type && log.target_id) {
      text += ` — ${log.target_type} #${AdminAPI.pd(log.target_id)}`;
    }
    return text;
  }

  function timeAgo(str) {
    if (!str) return '—';
    const diff = Date.now() - new Date(/^\d{4}-\d{2}-\d{2} /.test(str) ? str.replace(' ', 'T') + 'Z' : str).getTime();
    if (Number.isNaN(diff)) return '—';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'همین الان';
    if (minutes < 60) return `${AdminAPI.pd(minutes)} دقیقه پیش`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${AdminAPI.pd(hours)} ساعت پیش`;
    const days = Math.floor(hours / 24);
    return `${AdminAPI.pd(days)} روز پیش`;
  }

  function renderLogs(logs) {
    if (!logs.length) {
      listEl.innerHTML = '<p class="admin-empty-msg">فعالیتی ثبت نشده است</p>';
      return;
    }

    listEl.innerHTML = logs.map((log) => {
      const metaParts = [timeAgo(log.created_at), AdminAPI.formatDateTime(log.created_at)];
      if (log.ip_address) metaParts.push(`IP: ${log.ip_address}`);
      return `
        <div class="admin-timeline-item">
          <div class="admin-timeline-dot">${ACTION_ICONS[log.action] || '📋'}</div>
          <div class="admin-timeline-body">
            <div class="admin-timeline-action">${log.admin_username} — ${actionText(log)}</div>
            <div class="admin-timeline-meta">${metaParts.join(' · ')}</div>
          </div>
        </div>`;
    }).join('');
  }

  function renderPagination(total, currentPage) {
    if (!paginationEl) return;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    if (totalPages <= 1) {
      paginationEl.innerHTML = total
        ? `<span>${AdminAPI.pd(total)} مورد</span>`
        : '';
      return;
    }
    paginationEl.innerHTML = `
      <button type="button" class="admin-btn secondary sm" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">قبلی</button>
      <span>صفحه ${AdminAPI.pd(currentPage)} از ${AdminAPI.pd(totalPages)} — ${AdminAPI.pd(total)} مورد</span>
      <button type="button" class="admin-btn secondary sm" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">بعدی</button>
    `;
    paginationEl.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => load(Number(btn.dataset.page)));
    });
  }

  async function load(nextPage = page) {
    page = nextPage;
    listEl.innerHTML = '<p class="admin-empty-msg">در حال بارگذاری...</p>';
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (adminFilter) params.set('admin_id', adminFilter);
      const data = await AdminAPI.get(`/api/admin/activity-log?${params}`);
      renderLogs(data.logs || []);
      renderPagination(data.total || 0, data.page || page);
    } catch (err) {
      listEl.innerHTML = `<p class="admin-empty-msg">${err.message || 'خطا در بارگذاری'}</p>`;
      paginationEl.innerHTML = '';
    }
  }

  async function loadAdminFilter() {
    try {
      const me = await AdminAPI.get('/api/admin/auth/me');
      if (me.admin?.role !== 'superadmin') {
        window.location.href = '/admin/dashboard.html';
        return;
      }
      const data = await AdminAPI.get('/api/admin/admins');
      const admins = data.admins || [];
      adminSelect.innerHTML = '<option value="">همه مدیران</option>' + admins.map((a) =>
        `<option value="${a.id}">${a.username}</option>`
      ).join('');
    } catch (_) {
      /* filter stays empty */
    }
  }

  adminSelect?.addEventListener('change', () => {
    adminFilter = adminSelect.value;
    load(1);
  });

  loadAdminFilter().then(() => load(1));
})();
