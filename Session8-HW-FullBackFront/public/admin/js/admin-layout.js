function initAdminLayout(activePage) {
  document.querySelectorAll('.admin-nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.page === activePage);
  });

  AdminAPI.get('/api/admin/auth/me').then(data => {
    const el = document.getElementById('admin-username-display');
    if (el) el.textContent = data.admin.username;

    if (data.admin.role !== 'superadmin') {
      ['nav-admins', 'nav-history'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }
  }).catch(() => {
    window.location.href = '/admin/login.html';
  });

  document.getElementById('btn-admin-logout')?.addEventListener('click', async () => {
    try {
      await AdminAPI.post('/api/admin/auth/logout', {});
    } catch (_) { /* redirect anyway */ }
    window.location.href = '/admin/login.html';
  });

  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  toggle?.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!sidebar || !toggle) return;
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

window.initAdminLayout = initAdminLayout;

function adminCloseModal(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;
  el.classList.add('hidden');
  el.hidden = true;
}

function adminOpenModal(id) {
  adminCloseAllModals();
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  el.hidden = false;
}

function adminCloseAllModals() {
  document.querySelectorAll('.admin-modal-overlay').forEach(adminCloseModal);
}

window.adminCloseModal = adminCloseModal;
window.adminOpenModal = adminOpenModal;
window.adminCloseAllModals = adminCloseAllModals;

function ensureConfirmModal() {
  if (document.getElementById('admin-confirm-modal')) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="admin-modal-overlay hidden" id="admin-confirm-modal" hidden>
      <div class="admin-modal admin-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
        <div class="admin-modal-header" style="margin-bottom:12px">
          <h2 class="admin-modal-title" id="admin-confirm-title">تایید عملیات</h2>
        </div>
        <p class="admin-confirm-message" id="admin-confirm-message"></p>
        <div class="admin-modal-actions admin-confirm-actions">
          <button type="button" class="admin-btn secondary" id="admin-confirm-cancel">انصراف</button>
          <button type="button" class="admin-btn primary" id="admin-confirm-ok">تایید</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);
}

function adminConfirm(message, options = {}) {
  ensureConfirmModal();

  return new Promise((resolve) => {
    const modal = document.getElementById('admin-confirm-modal');
    const titleEl = document.getElementById('admin-confirm-title');
    const msgEl = document.getElementById('admin-confirm-message');
    const okBtn = document.getElementById('admin-confirm-ok');
    const cancelBtn = document.getElementById('admin-confirm-cancel');

    titleEl.textContent = options.title || 'تایید عملیات';
    msgEl.textContent = message;
    okBtn.textContent = options.confirmLabel || 'تایید';
    cancelBtn.textContent = options.cancelLabel || 'انصراف';
    okBtn.className = `admin-btn ${options.danger ? 'danger' : 'primary'}`;

    function finish(result) {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKeydown);
      adminCloseModal('admin-confirm-modal');
      resolve(result);
    }

    function onOk() { finish(true); }
    function onCancel() { finish(false); }
    function onBackdrop(e) {
      if (e.target === modal) finish(false);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') finish(false);
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKeydown);

    modal.classList.remove('hidden');
    modal.hidden = false;
    cancelBtn.focus();
  });
}

window.adminConfirm = adminConfirm;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ensureConfirmModal();
    adminCloseAllModals();
  });
} else {
  ensureConfirmModal();
  adminCloseAllModals();
}
