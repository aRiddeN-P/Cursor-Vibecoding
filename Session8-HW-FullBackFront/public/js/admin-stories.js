/* ============================================================
   Dakhlyar — Dev admin panel for stories (Phase 2)
   - Toggle dev admin session
   - List stories (active + inactive) with thumbnails
   - Upload a new story with file preview
   - Toggle is_active / delete
   - Reset has_seen_stories for all users
   ============================================================ */

(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function showToast(msg, type = 'success', t = 4000) {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (type === 'error' ? ' error' : '');
    setTimeout(() => { el.className = 'toast'; }, t);
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, Object.assign({
      credentials: 'same-origin',
    }, opts));
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data: data || {} };
  }

  async function apiJson(path, method, body) {
    return api(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // ============================================================
  //                    Admin status section
  // ============================================================

  let currentlyAdmin = false;

  async function refreshAdminStatus() {
    const { data } = await api('/api/admin/stories/admin-status');
    currentlyAdmin = !!data.isAdmin;

    const pill = $('#adminStatus');
    pill.className = 'status-pill ' + (currentlyAdmin ? 'on' : 'off');
    pill.textContent = currentlyAdmin
      ? '✓ وارد به عنوان ادمین (Dev)'
      : '✗ وارد نشده — برای انجام عملیات ابتدا وارد شوید';

    $('#devLoginBtn').style.display = currentlyAdmin ? 'none' : '';
    $('#devLogoutBtn').style.display = currentlyAdmin ? '' : 'none';

    if (currentlyAdmin) {
      await refreshStoriesList();
    } else {
      $('#storiesList').innerHTML = '';
      $('#storiesEmpty').style.display = 'block';
      $('#storiesEmpty').textContent = 'برای دیدن لیست استوری‌ها وارد حالت ادمین شوید.';
    }
  }

  $('#devLoginBtn').addEventListener('click', async () => {
    const { status, data } = await apiJson('/api/admin/stories/dev-login', 'POST');
    if (status === 200) {
      showToast(data.message || 'ورود موفق', 'success');
      await refreshAdminStatus();
    } else {
      showToast(data.message || 'ورود ناموفق', 'error');
    }
  });

  $('#devLogoutBtn').addEventListener('click', async () => {
    await apiJson('/api/admin/stories/dev-logout', 'POST');
    showToast('از حالت ادمین خارج شدید', 'success');
    await refreshAdminStatus();
  });

  // ============================================================
  //                    Stories list section
  // ============================================================

  async function refreshStoriesList() {
    const { status, data } = await api('/api/admin/stories');
    const list = $('#storiesList');
    const empty = $('#storiesEmpty');
    list.innerHTML = '';

    if (status !== 200) {
      empty.style.display = 'block';
      empty.textContent = data.message || 'خطا در بارگذاری استوری‌ها';
      return;
    }

    const stories = (data.stories || []);
    if (!stories.length) {
      empty.style.display = 'block';
      empty.textContent = 'هیچ استوری ثبت نشده است.';
      return;
    }
    empty.style.display = 'none';

    // Pre-fill order_index input to be max + 1
    const maxIdx = Math.max(0, ...stories.map((s) => s.order_index));
    $('#orderIndex').value = String(maxIdx + 1);

    for (const s of stories) {
      const tile = document.createElement('div');
      tile.className = 'story-tile' + (s.is_active ? '' : ' inactive');

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.style.backgroundImage = `url("${s.image_url}")`;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `
        <span>#${s.order_index}</span>
        <span>${s.is_active ? '🟢 فعال' : '⚪ غیرفعال'}</span>
      `;

      const actions = document.createElement('div');
      actions.className = 'actions';
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.textContent = s.is_active ? 'غیرفعال' : 'فعال';
      toggleBtn.addEventListener('click', () => toggleActive(s.id, s.is_active ? 0 : 1));
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger';
      delBtn.textContent = 'حذف';
      delBtn.addEventListener('click', () => deleteStory(s.id));
      actions.appendChild(toggleBtn);
      actions.appendChild(delBtn);

      tile.appendChild(thumb);
      tile.appendChild(meta);
      tile.appendChild(actions);
      list.appendChild(tile);
    }
  }

  async function toggleActive(id, nextActive) {
    const { status, data } = await apiJson(`/api/admin/stories/${id}`, 'PATCH', { is_active: nextActive });
    if (status === 200) {
      showToast(nextActive ? 'استوری فعال شد' : 'استوری غیرفعال شد', 'success');
      await refreshStoriesList();
    } else {
      showToast(data.message || 'عملیات ناموفق بود', 'error');
    }
  }

  async function deleteStory(id) {
    const ok = await DakhlyarModal.confirm({
      title: 'حذف استوری',
      message: 'این استوری حذف شود؟ این عملیات بازگشت‌ناپذیر است.',
      confirmText: 'حذف',
      cancelText: 'انصراف',
      type: 'danger',
    });
    if (!ok) return;
    const { status, data } = await api(`/api/admin/stories/${id}`, { method: 'DELETE' });
    if (status === 200) {
      showToast('استوری حذف شد', 'success');
      await refreshStoriesList();
    } else {
      DakhlyarModal.alert({ message: data.message || 'حذف ناموفق بود', subType: 'error' });
    }
  }

  // ============================================================
  //                    Upload section
  // ============================================================

  const fileInp = $('#storyFile');
  const previewWrap = $('#previewWrap');
  const previewImg = $('#previewImg');
  const previewMeta = $('#previewMeta');

  fileInp.addEventListener('change', () => {
    const f = fileInp.files && fileInp.files[0];
    if (!f) {
      previewWrap.classList.remove('show');
      previewImg.removeAttribute('src');
      return;
    }
    const url = URL.createObjectURL(f);
    previewImg.src = url;
    previewMeta.textContent = `${f.name} — ${(f.size / 1024).toFixed(0)} KB`;
    previewWrap.classList.add('show');
  });

  $('#uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = fileInp.files && fileInp.files[0];
    if (!f) {
      showToast('یک فایل تصویر انتخاب کنید', 'error');
      return;
    }
    const idx = parseInt($('#orderIndex').value, 10);
    if (!Number.isInteger(idx) || idx < 1) {
      showToast('ترتیب نمایش باید عدد صحیح و بزرگ‌تر از صفر باشد', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('image', f);
    fd.append('order_index', String(idx));

    const submitBtn = e.submitter || $('#uploadForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'در حال آپلود...';
    try {
      const res = await fetch('/api/admin/stories/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast('استوری با موفقیت آپلود شد', 'success');
        fileInp.value = '';
        previewWrap.classList.remove('show');
        previewImg.removeAttribute('src');
        await refreshStoriesList();
      } else {
        showToast(data.message || 'آپلود ناموفق بود', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('خطای ارتباط با سرور', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'آپلود استوری';
    }
  });

  // ============================================================
  //                    Reset / test actions
  // ============================================================

  $('#resetBtn').addEventListener('click', async () => {
    const ok = await DakhlyarModal.confirm({
      title: 'ریست استوری‌ها',
      message: 'وضعیت دیده‌شدن استوری‌ها برای همه‌ی کاربران ریست شود؟ پس از این، استوری‌ها برای همه دوباره نمایش داده می‌شوند.',
      confirmText: 'ریست برای همه',
      cancelText: 'انصراف',
      type: 'danger',
    });
    if (!ok) return;
    const { status, data } = await apiJson('/api/admin/stories/reset-for-users', 'POST');
    if (status === 200) {
      DakhlyarModal.alert({
        message: data.message || 'استوری برای همه کاربران ریست شد',
        subType: 'success',
      });
    } else {
      DakhlyarModal.alert({
        message: data.message || 'ریست ناموفق بود',
        subType: 'error',
      });
    }
  });

  $('#testBtn').addEventListener('click', async () => {
    const { status, data } = await apiJson('/api/admin/stories/reset-for-users', 'POST');
    if (status !== 200) {
      showToast(data.message || 'ریست ناموفق بود', 'error');
      return;
    }
    location.href = '/dashboard';
  });

  // ---------- init ----------
  refreshAdminStatus();
})();
