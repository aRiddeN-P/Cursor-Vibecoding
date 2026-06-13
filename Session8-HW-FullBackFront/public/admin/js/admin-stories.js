(function () {
  let stories = [];
  let userTotal = 0;

  const listEl = document.getElementById('stories-list');
  const modal = document.getElementById('upload-modal');
  const fileInput = document.getElementById('story-file');
  const previewImg = document.getElementById('story-preview');
  const orderInput = document.getElementById('story-order');

  function initDragDrop(container) {
    let dragSrc = null;

    container.querySelectorAll('.story-card').forEach((card) => {
      card.setAttribute('draggable', 'true');

      card.addEventListener('dragstart', (e) => {
        dragSrc = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        saveNewOrder(container);
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dragSrc || dragSrc === card) return;
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          container.insertBefore(dragSrc, card);
        } else {
          container.insertBefore(dragSrc, card.nextSibling);
        }
      });
    });
  }

  async function saveNewOrder(container) {
    const cards = container.querySelectorAll('.story-card');
    const updates = [];
    cards.forEach((card, idx) => {
      const id = Number(card.dataset.id);
      const oldIdx = Number(card.dataset.orderIndex);
      if (oldIdx !== idx + 1) {
        updates.push({ id, order_index: idx + 1 });
        card.dataset.orderIndex = idx + 1;
      }
    });

    if (!updates.length) return;

    let ok = 0;
    let fail = 0;
    for (const u of updates) {
      try {
        await AdminAPI.patch(`/api/admin/stories/${u.id}`, { order_index: u.order_index });
        ok++;
      } catch (_) {
        fail++;
      }
    }

    if (fail && ok) {
      AdminAPI.showToast(`ترتیب ${AdminAPI.pd(ok)} استوری ذخیره شد — ${AdminAPI.pd(fail)} مورد خطا داشت`, 'warning');
    } else if (fail) {
      AdminAPI.showToast('خطا در ذخیره ترتیب', 'error');
    } else {
      AdminAPI.showToast('ترتیب استوری‌ها ذخیره شد');
    }
    await loadStories();
  }

  function renderStories() {
    if (!stories.length) {
      listEl.innerHTML = '<div class="admin-empty-msg">هنوز استوری‌ای آپلود نشده است</div>';
      return;
    }

    listEl.innerHTML = stories
      .sort((a, b) => a.order_index - b.order_index || a.id - b.id)
      .map((s, i) => {
        const active = s.is_active ? 1 : 0;
        return `
          <div class="story-card" data-id="${s.id}" data-order-index="${s.order_index}">
            <span class="story-drag-handle" title="کشیدن برای تغییر ترتیب">⠿</span>
            <img class="story-thumb" src="${s.image_url}" alt="استوری ${AdminAPI.pd(i + 1)}" />
            <div class="story-info">
              <div class="story-title">استوری ${AdminAPI.pd(i + 1)}</div>
              <div class="story-meta">
                ترتیب: ${AdminAPI.pd(s.order_index)} |
                وضعیت: ${active ? 'فعال' : 'غیرفعال'} |
                آپلود: ${AdminAPI.formatDate(s.created_at)}
              </div>
            </div>
            <div class="story-actions">
              <label class="admin-toggle" title="${active ? 'غیرفعال کردن' : 'فعال کردن'}">
                <input type="checkbox" ${active ? 'checked' : ''} data-toggle-id="${s.id}" />
                <span class="admin-toggle-track"></span>
                <span class="admin-toggle-thumb"></span>
              </label>
              <button type="button" class="admin-btn danger sm" data-delete-id="${s.id}">حذف</button>
            </div>
          </div>`;
      })
      .join('');

    initDragDrop(listEl);

    listEl.querySelectorAll('[data-toggle-id]').forEach((inp) => {
      inp.addEventListener('change', async () => {
        const id = inp.dataset.toggleId;
        try {
          await AdminAPI.patch(`/api/admin/stories/${id}`, { is_active: inp.checked ? 1 : 0 });
          AdminAPI.showToast(inp.checked ? 'استوری فعال شد' : 'استوری غیرفعال شد');
          await loadStories();
        } catch (err) {
          inp.checked = !inp.checked;
          AdminAPI.showToast(err.message || 'خطا', 'error');
        }
      });
    });

    listEl.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', () => deleteStory(btn.dataset.deleteId));
    });
  }

  async function loadStories() {
    try {
      const data = await AdminAPI.get('/api/admin/stories');
      stories = data.stories || [];
      renderStories();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا در بارگذاری', 'error');
    }
  }

  async function deleteStory(id) {
    if (!await AdminAPI.confirm('این استوری حذف شود؟', { danger: true, confirmLabel: 'حذف' })) return;
    try {
      await AdminAPI.delete(`/api/admin/stories/${id}`);
      AdminAPI.showToast('استوری حذف شد');
      await loadStories();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function resetAll() {
    try {
      if (!userTotal) {
        const ov = await AdminAPI.get('/api/admin/stats/overview');
        userTotal = ov.users?.total || 0;
      }
      if (!await AdminAPI.confirm(
        `استوری برای همه ${AdminAPI.pd(userTotal)} کاربر ریست می‌شود. ادامه می‌دهید؟`,
        { title: 'ریست استوری', confirmLabel: 'ریست' }
      )) return;
      const data = await AdminAPI.post('/api/admin/stories/reset-for-users');
      AdminAPI.showToast(`استوری برای ${AdminAPI.pd(data.total_users || data.affected_users || userTotal)} کاربر ریست شد`);
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  function openModal() {
    fileInput.value = '';
    previewImg.classList.add('hidden');
    orderInput.value = String((stories.length || 0) + 1);
    adminOpenModal('upload-modal');
  }

  function closeModal() {
    adminCloseModal('upload-modal');
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) {
      previewImg.classList.add('hidden');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      AdminAPI.showToast('حجم فایل بیش از ۵ مگابایت است', 'error');
      fileInput.value = '';
      return;
    }
    previewImg.src = URL.createObjectURL(file);
    previewImg.classList.remove('hidden');
  });

  document.getElementById('btn-upload-story').addEventListener('click', openModal);
  document.getElementById('btn-reset-stories').addEventListener('click', resetAll);
  document.getElementById('upload-modal-close').addEventListener('click', closeModal);
  document.getElementById('upload-modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) {
      AdminAPI.showToast('فایل تصویر را انتخاب کنید', 'error');
      return;
    }
    const fd = new FormData();
    fd.append('image', file);
    fd.append('order_index', orderInput.value);
    try {
      await AdminAPI.upload('/api/admin/stories/upload', fd);
      AdminAPI.showToast('استوری آپلود شد');
      closeModal();
      await loadStories();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا در آپلود', 'error');
    }
  });

  loadStories();
})();
