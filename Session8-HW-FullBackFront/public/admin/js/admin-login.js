(function () {
  const loginForm = document.getElementById('login-form');
  const changeForm = document.getElementById('change-form');
  const errorEl = document.getElementById('login-error');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('show');
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('show');
  }

  function showChangeForm() {
    loginForm.classList.add('hidden');
    changeForm.classList.remove('hidden');
    clearError();
  }

  async function checkSession() {
    try {
      const res = await fetch('/api/admin/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        window.location.href = '/admin/dashboard.html';
      }
    } catch (_) { /* stay on login */ }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const btn = document.getElementById('btn-login');
    btn.disabled = true;

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('username').value.trim(),
          password: document.getElementById('password').value,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(data.message || 'خطا در ورود');
        return;
      }

      if (data.must_change) {
        showChangeForm();
        return;
      }

      window.location.href = '/admin/dashboard.html';
    } catch (_) {
      showError('خطا در ارتباط با سرور');
    } finally {
      btn.disabled = false;
    }
  });

  changeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    const btn = document.getElementById('btn-change');
    btn.disabled = true;

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(data.message || 'خطا در تغییر رمز عبور');
        return;
      }

      window.location.href = '/admin/dashboard.html';
    } catch (_) {
      showError('خطا در ارتباط با سرور');
    } finally {
      btn.disabled = false;
    }
  });

  checkSession();
})();
