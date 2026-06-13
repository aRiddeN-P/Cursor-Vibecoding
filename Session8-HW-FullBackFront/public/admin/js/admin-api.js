const AdminAPI = {
  async fetch(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: opts.body && !(opts.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {},
      ...opts
    });
    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      throw new Error('unauthorized');
    }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) throw Object.assign(new Error(data?.message || `HTTP ${res.status}`), { data });
    return data;
  },

  get: (path) => AdminAPI.fetch(path),
  post: (path, body) => AdminAPI.fetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => AdminAPI.fetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => AdminAPI.fetch(path, { method: 'DELETE' }),
  upload: (path, formData, method = 'POST') => AdminAPI.fetch(path, { method, body: formData }),

  showToast(msg, type = 'success') {
    const old = document.getElementById('admin-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'admin-toast';
    el.className = `admin-toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },

  pd(n) {
    return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  },

  normalizeDigits(value) {
    if (value == null) return '';
    return String(value)
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .trim();
  },

  fmtMoney(n) {
    return this.pd(Number(n || 0).toLocaleString('en'));
  },

  formatDate(str) {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('fa-IR');
  },

  formatDateTime(str) {
    if (!str) return '—';
    return new Date(str).toLocaleString('fa-IR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  },

  confirm(message, options) {
    return window.adminConfirm(message, options);
  },
};

window.AdminAPI = AdminAPI;
