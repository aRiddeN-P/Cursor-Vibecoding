(function () {
  let userTotal = 0;
  let subscriberCount = 0;
  let activeRecs = [];
  let directUser = null;
  let expertDirectUser = null;
  let bulkMsgUserIds = [];
  let bulkExpertUserIds = [];
  let historyPage = 1;
  let historyFilter = { target: '', period: 'all' };

  const tabs = document.querySelectorAll('.admin-tab-btn[data-msg-tab]');
  const panels = document.querySelectorAll('.admin-tab-panel[data-msg-panel]');
  const sendTabs = document.querySelectorAll('#send-tabs .admin-tab-btn[data-send-tab]');
  const sendPanels = document.querySelectorAll('.messaging-send-panel[data-send-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`[data-msg-panel="${tab.dataset.msgTab}"]`)?.classList.add('active');
      if (tab.dataset.msgTab === 'history') loadHistory();
    });
  });

  sendTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      sendTabs.forEach((t) => t.classList.remove('active'));
      sendPanels.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`[data-send-panel="${tab.dataset.sendTab}"]`)?.classList.add('active');
    });
  });

  function setExpiresInput(input, ms) {
    AdminDatePicker.setValue(input, new Date(Date.now() + ms));
  }

  function bindQuickExpires(container, input) {
    container.querySelectorAll('[data-expires]').forEach((btn) => {
      btn.addEventListener('click', () => setExpiresInput(input, Number(btn.dataset.expires)));
    });
  }

  function bindPreview(titleEl, bodyEl, expiresEl, previewTitle, previewBody, previewMeta) {
    function update() {
      previewTitle.textContent = titleEl.value.trim() || 'عنوان پیام';
      previewBody.textContent = bodyEl.value.trim() || 'متن پیام اینجا نمایش داده می‌شود...';
      if (previewMeta && expiresEl) {
        previewMeta.textContent = expiresEl.value
          ? `انقضا: ${AdminDatePicker.formatPreview(expiresEl)}`
          : 'تاریخ انقضا تنظیم نشده';
      }
    }
    titleEl.addEventListener('input', update);
    bodyEl.addEventListener('input', update);
    expiresEl?.addEventListener('change', update);
    update();
  }

  function bindCounter(input, counter, max) {
    input.addEventListener('input', () => {
      counter.textContent = `${AdminAPI.pd(input.value.length)}/${AdminAPI.pd(max)}`;
    });
    counter.textContent = `${AdminAPI.pd(0)}/${AdminAPI.pd(max)}`;
  }

  async function searchUser(mobile, resultEl, onFound) {
    const query = AdminAPI.normalizeDigits(mobile.trim());
    resultEl.innerHTML = '<div class="admin-form-hint">در حال جستجو...</div>';
    try {
      const data = await AdminAPI.get(`/api/admin/users/search?mobile=${encodeURIComponent(query)}`);
      const users = data.users || [];
      const exact = users.find((u) => AdminAPI.normalizeDigits(u.mobile) === query) || users[0];
      if (!exact) {
        resultEl.innerHTML = `
          <div class="user-search-result not-found">
            <span>کاربر یافت نشد</span>
          </div>`;
        onFound(null);
        return;
      }
      const name = [exact.first_name, exact.last_name].filter(Boolean).join(' ') || 'کاربر';
      const verif = exact.verification_level != null ? `سطح ${AdminAPI.pd(exact.verification_level)}` : '';
      const sub = exact.subscription_plan ? exact.subscription_plan : 'بدون اشتراک';
      resultEl.innerHTML = `
        <div class="user-search-result">
          <div class="user-search-avatar">${name.charAt(0)}</div>
          <div class="user-search-info">
            <div class="user-search-name">${name}</div>
            <div class="user-search-mobile">${exact.mobile}</div>
            <div class="admin-form-hint">${verif} · ${sub}</div>
          </div>
        </div>`;
      onFound(exact);
    } catch (err) {
      resultEl.innerHTML = `<div class="user-search-result not-found">${err.message || 'خطا'}</div>`;
      onFound(null);
    }
  }

  function showProgressModal(label, total) {
    const modal = document.getElementById('progress-modal');
    document.getElementById('progress-label').textContent = label;
    document.getElementById('progress-detail').textContent = `۰ از ${AdminAPI.pd(total)} کاربر پردازش شد`;
    document.getElementById('progress-fill').style.width = '0%';
    adminOpenModal('progress-modal');
    let pct = 0;
    const iv = setInterval(() => {
      pct = Math.min(pct + 17, 85);
      document.getElementById('progress-fill').style.width = `${pct}%`;
      document.getElementById('progress-detail').textContent =
        `${AdminAPI.pd(Math.round(total * pct / 100))} از ${AdminAPI.pd(total)} کاربر پردازش شد`;
    }, 120);
    return () => {
      clearInterval(iv);
      document.getElementById('progress-fill').style.width = '100%';
      setTimeout(() => adminCloseModal('progress-modal'), 400);
    };
  }

  function showSuccessModal(title, lines, onHistory) {
    const modal = document.getElementById('success-modal');
    document.getElementById('success-title').textContent = title;
    document.getElementById('success-body').innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
    adminOpenModal('success-modal');
    document.getElementById('success-close').onclick = () => adminCloseModal('success-modal');
    document.getElementById('success-history').onclick = () => {
      adminCloseModal('success-modal');
      document.querySelector('[data-msg-tab="history"]').click();
      if (onHistory) onHistory();
    };
  }

  function confirmDialog(msg, options) {
    return AdminAPI.confirm(msg, options);
  }

  function renderImportResult(el, data) {
    el.classList.remove('hidden', 'success', 'warn');
    const hasUnmatched = (data.unmatched_count || 0) > 0;
    el.classList.add(data.matched_count ? (hasUnmatched ? 'warn' : 'success') : 'warn');
    const unmatchedHint = hasUnmatched
      ? `<div class="admin-form-hint">نمونه یافت‌نشده: ${(data.unmatched_samples || []).slice(0, 5).join('، ') || '—'}</div>`
      : '';
    el.innerHTML = `
      <div class="msg-import-stat">
        <span class="ok">${AdminAPI.pd(data.matched_count || 0)} کاربر یافت شد</span>
        ${hasUnmatched ? `<span class="bad">${AdminAPI.pd(data.unmatched_count)} یافت نشد</span>` : ''}
        <span class="muted">${AdminAPI.pd(data.unique_mobiles || 0)} موبایل یکتا در فایل</span>
      </div>
      ${unmatchedHint}`;
  }

  async function parseMobileFile(fileInput, endpoint, resultEl, onParsed) {
    const file = fileInput.files?.[0];
    if (!file) {
      AdminAPI.showToast('فایل را انتخاب کنید', 'error');
      return;
    }
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = '<div class="admin-form-hint">در حال بررسی فایل...</div>';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await AdminAPI.upload(endpoint, fd);
      renderImportResult(resultEl, data);
      onParsed(data.user_ids || []);
    } catch (err) {
      resultEl.classList.add('warn');
      resultEl.innerHTML = `<span class="bad">${err.message || 'خطا در پردازش فایل'}</span>`;
      onParsed([]);
    }
  }

  // ── Broadcast form ──
  const bcTitle = document.getElementById('bc-title');
  const bcBody = document.getElementById('bc-body');
  const bcExpires = document.getElementById('bc-expires');
  const bcPush = document.getElementById('bc-push');

  bindCounter(bcTitle, document.getElementById('bc-title-counter'), 80);
  bindCounter(bcBody, document.getElementById('bc-body-counter'), 1000);
  bindQuickExpires(document.getElementById('bc-expires-quick'), bcExpires);
  bindPreview(bcTitle, bcBody, bcExpires,
    document.getElementById('bc-preview-title'),
    document.getElementById('bc-preview-body'),
    document.getElementById('bc-preview-meta'));

  document.getElementById('bc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!await confirmDialog(`این پیام برای ${AdminAPI.pd(userTotal)} کاربر ارسال می‌شود. آیا مطمئن هستید؟`, { title: 'ارسال پیام گروهی', confirmLabel: 'ارسال' })) return;
    const expiresAt = AdminDatePicker.getIso(bcExpires);
    if (!expiresAt) {
      AdminAPI.showToast('تاریخ انقضا را انتخاب کنید', 'error');
      return;
    }
    const done = showProgressModal('در حال ارسال پیام...', userTotal);
    try {
      const data = await AdminAPI.post('/api/admin/messages/send', {
        target: 'all',
        title: bcTitle.value.trim(),
        body: bcBody.value.trim(),
        expires_at: expiresAt,
        send_push: bcPush.checked,
      });
      done();
      showSuccessModal('✓ پیام ارسال شد', [
        `${AdminAPI.pd(data.sent_count)} کاربر پیام دریافت کردند`,
        data.push_queued ? 'پوش نوتیفیکیشن در صف ارسال قرار گرفت' : 'پوش نوتیفیکیشن ارسال نشد',
      ]);
      bcTitle.value = '';
      bcBody.value = '';
    } catch (err) {
      done();
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  });

  // ── Bulk message (Excel) ──
  const bulkMsgTitle = document.getElementById('bulk-msg-title');
  const bulkMsgBody = document.getElementById('bulk-msg-body');
  const bulkMsgExpires = document.getElementById('bulk-msg-expires');
  const bulkMsgPush = document.getElementById('bulk-msg-push');
  const bulkMsgParseResult = document.getElementById('bulk-msg-parse-result');
  const bulkMsgSendBtn = document.getElementById('btn-bulk-msg-send');
  const bulkMsgFile = document.getElementById('bulk-msg-file');

  bindCounter(bulkMsgTitle, document.getElementById('bulk-msg-title-counter'), 80);
  bindCounter(bulkMsgBody, document.getElementById('bulk-msg-body-counter'), 1000);
  bindQuickExpires(document.getElementById('bulk-msg-expires-quick'), bulkMsgExpires);

  bulkMsgFile.addEventListener('change', () => {
    bulkMsgUserIds = [];
    bulkMsgSendBtn.disabled = true;
    bulkMsgParseResult.classList.add('hidden');
  });

  document.getElementById('btn-bulk-msg-parse').addEventListener('click', () => {
    parseMobileFile(
      bulkMsgFile,
      '/api/admin/messages/parse-mobiles',
      bulkMsgParseResult,
      (ids) => {
        bulkMsgUserIds = ids;
        bulkMsgSendBtn.disabled = !ids.length;
      }
    );
  });

  document.getElementById('bulk-msg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!bulkMsgUserIds.length) {
      AdminAPI.showToast('ابتدا فایل را بررسی کنید', 'error');
      return;
    }
    if (!await confirmDialog(
      `این پیام برای ${AdminAPI.pd(bulkMsgUserIds.length)} کاربر از فایل ارسال می‌شود. ادامه می‌دهید؟`,
      { title: 'ارسال پیام گروهی', confirmLabel: 'ارسال' }
    )) return;
    const expiresAt = AdminDatePicker.getIso(bulkMsgExpires);
    if (!expiresAt) {
      AdminAPI.showToast('تاریخ انقضا را انتخاب کنید', 'error');
      return;
    }
    const done = showProgressModal('در حال ارسال پیام...', bulkMsgUserIds.length);
    try {
      const data = await AdminAPI.post('/api/admin/messages/send', {
        target: 'mobile_list',
        user_ids: bulkMsgUserIds,
        title: bulkMsgTitle.value.trim(),
        body: bulkMsgBody.value.trim(),
        expires_at: expiresAt,
        send_push: bulkMsgPush.checked,
      });
      done();
      showSuccessModal('✓ پیام ارسال شد', [
        `${AdminAPI.pd(data.sent_count)} کاربر پیام دریافت کردند`,
        data.push_queued ? 'پوش نوتیفیکیشن در صف ارسال قرار گرفت' : 'پوش نوتیفیکیشن ارسال نشد',
      ]);
      bulkMsgTitle.value = '';
      bulkMsgBody.value = '';
      bulkMsgFile.value = '';
      bulkMsgUserIds = [];
      bulkMsgSendBtn.disabled = true;
      bulkMsgParseResult.classList.add('hidden');
    } catch (err) {
      done();
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  });

  // ── Direct form ──
  const dirTitle = document.getElementById('dir-title');
  const dirBody = document.getElementById('dir-body');
  const dirExpires = document.getElementById('dir-expires');
  const dirPush = document.getElementById('dir-push');
  const dirResult = document.getElementById('dir-user-result');

  bindCounter(dirTitle, document.getElementById('dir-title-counter'), 80);
  bindCounter(dirBody, document.getElementById('dir-body-counter'), 1000);
  bindQuickExpires(document.getElementById('dir-expires-quick'), dirExpires);
  bindPreview(dirTitle, dirBody, dirExpires,
    document.getElementById('dir-preview-title'),
    document.getElementById('dir-preview-body'),
    document.getElementById('dir-preview-meta'));

  document.getElementById('btn-dir-search').addEventListener('click', () => {
    searchUser(document.getElementById('dir-mobile').value, dirResult, (u) => { directUser = u; });
  });

  document.getElementById('dir-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!directUser) {
      AdminAPI.showToast('ابتدا کاربر را جستجو کنید', 'error');
      return;
    }
    const name = [directUser.first_name, directUser.last_name].filter(Boolean).join(' ') || directUser.mobile;
    if (!await confirmDialog(`پیام برای ${name} ارسال می‌شود. ادامه می‌دهید؟`, { title: 'ارسال پیام مستقیم', confirmLabel: 'ارسال' })) return;
    const expiresAt = AdminDatePicker.getIso(dirExpires);
    if (!expiresAt) {
      AdminAPI.showToast('تاریخ انقضا را انتخاب کنید', 'error');
      return;
    }
    const done = showProgressModal('در حال ارسال پیام...', 1);
    try {
      await AdminAPI.post('/api/admin/messages/send', {
        target: 'user',
        user_id: directUser.id,
        title: dirTitle.value.trim(),
        body: dirBody.value.trim(),
        expires_at: expiresAt,
        send_push: dirPush.checked,
      });
      done();
      showSuccessModal('✓ پیام ارسال شد', [`پیام برای ${name} ارسال شد`]);
      dirTitle.value = '';
      dirBody.value = '';
    } catch (err) {
      done();
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  });

  // ── Expert recommendation ──
  let expertTarget = 'all_subscribed';
  const recSelect = document.getElementById('expert-rec-select');
  const expertPreview = document.getElementById('expert-preview');
  const expertUserWrap = document.getElementById('expert-user-wrap');
  const expertUserResult = document.getElementById('expert-user-result');

  document.querySelectorAll('#expert-target-pills .admin-filter-pill[data-expert-target]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#expert-target-pills .admin-filter-pill[data-expert-target]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      expertTarget = tab.dataset.expertTarget;
      expertUserWrap.classList.toggle('hidden', expertTarget !== 'user');
    });
  });

  function updateExpertPreview() {
    const id = Number(recSelect.value);
    const rec = activeRecs.find((r) => r.id === id);
    if (!rec) {
      expertPreview.innerHTML = '<p class="admin-form-hint">پیشنهادی انتخاب نشده</p>';
      return;
    }
    expertPreview.innerHTML = `
      <div class="rec-preview-card" style="margin-top:0">
        <div class="rec-preview-title">${rec.title}</div>
        <div class="rec-preview-body">${rec.body}</div>
      </div>`;
  }

  recSelect.addEventListener('change', updateExpertPreview);

  document.getElementById('btn-expert-search').addEventListener('click', () => {
    searchUser(document.getElementById('expert-mobile').value, expertUserResult, (u) => { expertDirectUser = u; });
  });

  document.getElementById('expert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const recId = Number(recSelect.value);
    if (!recId) {
      AdminAPI.showToast('پیشنهاد را انتخاب کنید', 'error');
      return;
    }
    const rec = activeRecs.find((r) => r.id === recId);
    const count = expertTarget === 'user' ? 1 : subscriberCount;
    if (expertTarget === 'user' && !expertDirectUser) {
      AdminAPI.showToast('کاربر را جستجو کنید', 'error');
      return;
    }
    if (!await confirmDialog(`پیشنهاد «${rec?.title || ''}» برای ${AdminAPI.pd(count)} کاربر ارسال می‌شود. ادامه می‌دهید؟`, { title: 'ارسال پیشنهاد', confirmLabel: 'ارسال' })) return;
    const done = showProgressModal('در حال ارسال پیشنهاد...', count);
    try {
      const payload = {
        target: expertTarget,
        recommendation_id: recId,
      };
      if (expertTarget === 'user') payload.user_id = expertDirectUser.id;
      const data = await AdminAPI.post('/api/admin/expert/send', payload);
      done();
      showSuccessModal('✓ پیشنهاد ارسال شد', [
        `${AdminAPI.pd(data.sent_count)} کاربر پیشنهاد دریافت کردند`,
        `عنوان: ${data.recommendation_title}`,
      ]);
    } catch (err) {
      done();
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  });

  // ── Bulk expert (Excel) ──
  const bulkExpertRecSelect = document.getElementById('bulk-expert-rec-select');
  const bulkExpertParseResult = document.getElementById('bulk-expert-parse-result');
  const bulkExpertSendBtn = document.getElementById('btn-bulk-expert-send');
  const bulkExpertFile = document.getElementById('bulk-expert-file');

  bulkExpertFile.addEventListener('change', () => {
    bulkExpertUserIds = [];
    bulkExpertSendBtn.disabled = true;
    bulkExpertParseResult.classList.add('hidden');
  });

  document.getElementById('btn-bulk-expert-parse').addEventListener('click', () => {
    parseMobileFile(
      bulkExpertFile,
      '/api/admin/expert/parse-mobiles',
      bulkExpertParseResult,
      (ids) => {
        bulkExpertUserIds = ids;
        bulkExpertSendBtn.disabled = !ids.length;
      }
    );
  });

  document.getElementById('bulk-expert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const recId = Number(bulkExpertRecSelect.value);
    if (!recId) {
      AdminAPI.showToast('پیشنهاد را انتخاب کنید', 'error');
      return;
    }
    if (!bulkExpertUserIds.length) {
      AdminAPI.showToast('ابتدا فایل را بررسی کنید', 'error');
      return;
    }
    const rec = activeRecs.find((r) => r.id === recId);
    if (!await confirmDialog(
      `پیشنهاد «${rec?.title || ''}» برای ${AdminAPI.pd(bulkExpertUserIds.length)} کاربر از فایل ارسال می‌شود. ادامه می‌دهید؟`,
      { title: 'ارسال پیشنهاد گروهی', confirmLabel: 'ارسال' }
    )) return;
    const done = showProgressModal('در حال ارسال پیشنهاد...', bulkExpertUserIds.length);
    try {
      const data = await AdminAPI.post('/api/admin/expert/send', {
        target: 'mobile_list',
        recommendation_id: recId,
        user_ids: bulkExpertUserIds,
      });
      done();
      const lines = [`${AdminAPI.pd(data.sent_count)} کاربر پیشنهاد دریافت کردند`];
      if (data.skipped_no_subscription) {
        lines.push(`${AdminAPI.pd(data.skipped_no_subscription)} کاربر بدون اشتراک فعال رد شدند`);
      }
      lines.push(`عنوان: ${data.recommendation_title}`);
      showSuccessModal('✓ پیشنهاد ارسال شد', lines);
      bulkExpertFile.value = '';
      bulkExpertUserIds = [];
      bulkExpertSendBtn.disabled = true;
      bulkExpertParseResult.classList.add('hidden');
    } catch (err) {
      done();
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  });

  // ── History ──
  function readRateClass(rate) {
    if (rate >= 70) return 'high';
    if (rate >= 40) return 'mid';
    return 'low';
  }

  async function loadHistory(page = 1) {
    historyPage = page;
    const params = new URLSearchParams({ page, limit: 20 });
    if (historyFilter.target) params.set('target', historyFilter.target);
    if (historyFilter.period !== 'all') params.set('period', historyFilter.period);

    try {
      const [hist, stats] = await Promise.all([
        AdminAPI.get(`/api/admin/messages/history?${params}`),
        AdminAPI.get('/api/admin/messages/stats'),
      ]);

      document.getElementById('hist-stat-today').textContent =
        `${AdminAPI.pd(stats.total_sent_today)} پیام امروز`;
      document.getElementById('hist-stat-month').textContent =
        `${AdminAPI.pd(stats.total_sent_this_month)} این ماه`;
      document.getElementById('hist-stat-rate').textContent =
        `نرخ خواندن: ${AdminAPI.pd(stats.avg_read_rate)}٪`;

      const tbody = document.getElementById('history-tbody');
      const rows = hist.messages || [];
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="admin-empty-msg">پیامی یافت نشد</td></tr>`;
      } else {
        tbody.innerHTML = rows.map((m) => {
          const typeBadge = m.target === 'all'
            ? '<span class="admin-badge blue">همه کاربران</span>'
            : `<span class="admin-badge green">مستقیم</span> <span dir="ltr">${m.user_mobile || ''}</span>`;
          const rateCls = readRateClass(m.read_rate || 0);
          return `
            <tr class="history-row" data-expand-id="${m.id}">
              <td>${m.title}</td>
              <td>${typeBadge}</td>
              <td>${m.target === 'all' ? 'همه' : (m.user_mobile || '—')}</td>
              <td>${AdminAPI.pd(m.sent_count)}</td>
              <td>${AdminAPI.pd(m.read_count)}</td>
              <td><span class="read-rate-bar ${rateCls}">${AdminAPI.pd(m.read_rate || 0)}٪</span></td>
              <td>${m.expires_at ? AdminAPI.formatDate(m.expires_at) : '—'}</td>
              <td>${m.sent_by || '—'}</td>
            </tr>
            <tr class="history-expand-row hidden" data-expand-body="${m.id}">
              <td colspan="8">
                <div class="msg-history-expand open">
                  <strong>متن کامل:</strong><br/>${m.body}
                  ${m.target === 'user' && m.user_mobile ? `<br/><br/><strong>گیرنده:</strong> ${m.user_mobile}` : ''}
                </div>
              </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.history-row').forEach((row) => {
          row.style.cursor = 'pointer';
          row.addEventListener('click', () => {
            const id = row.dataset.expandId;
            const exp = tbody.querySelector(`[data-expand-body="${id}"]`);
            exp?.classList.toggle('hidden');
          });
        });
      }

      renderPagination(hist);
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  function renderPagination(hist) {
    const el = document.getElementById('history-pagination');
    const { page, total, limit } = hist;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    if (totalPages <= 1) {
      el.innerHTML = total ? `<span>${AdminAPI.pd(total)} مورد</span>` : '';
      return;
    }
    el.innerHTML = `
      <button type="button" class="admin-btn secondary sm" ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">قبلی</button>
      <span>صفحه ${AdminAPI.pd(page)} از ${AdminAPI.pd(totalPages)}</span>
      <button type="button" class="admin-btn secondary sm" ${page >= totalPages ? 'disabled' : ''} data-p="${page + 1}">بعدی</button>`;
    el.querySelectorAll('[data-p]').forEach((btn) => {
      btn.addEventListener('click', () => loadHistory(Number(btn.dataset.p)));
    });
  }

  document.querySelectorAll('[data-hist-target]').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-hist-target]').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      historyFilter.target = pill.dataset.histTarget;
      loadHistory(1);
    });
  });

  document.querySelectorAll('[data-hist-period]').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-hist-period]').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      historyFilter.period = pill.dataset.histPeriod;
      loadHistory(1);
    });
  });

  async function init() {
    await AdminDatePicker.init(bcExpires, { value: new Date(Date.now() + 7 * 86400000) });
    await AdminDatePicker.init(dirExpires, { value: new Date(Date.now() + 7 * 86400000) });
    await AdminDatePicker.init(bulkMsgExpires, { value: new Date(Date.now() + 7 * 86400000) });

    const recOptions = (recs) => (recs.length
      ? recs.map((r) => `<option value="${r.id}">${r.title}</option>`).join('')
      : '<option value="">— پیشنهاد فعالی نیست —</option>');

    try {
      const [overview, subs, recs] = await Promise.all([
        AdminAPI.get('/api/admin/stats/overview'),
        AdminAPI.get('/api/admin/expert/recommendations/subscriber-count'),
        AdminAPI.get('/api/admin/expert/recommendations?is_active=1&limit=100'),
      ]);
      userTotal = overview.users?.total || 0;
      subscriberCount = subs.count || 0;
      activeRecs = recs.recommendations || [];

      document.getElementById('bc-recipient-count').innerHTML =
        `<i class="ti ti-users"></i> تعداد دریافت‌کنندگان: ${AdminAPI.pd(userTotal)} کاربر`;
      document.getElementById('expert-sub-count').innerHTML =
        `<i class="ti ti-crown"></i> ${AdminAPI.pd(subscriberCount)} کاربر دارای اشتراک فعال`;

      recSelect.innerHTML = recOptions(activeRecs);
      bulkExpertRecSelect.innerHTML = recOptions(activeRecs);
      updateExpertPreview();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا در بارگذاری', 'error');
    }
  }

  init();
})();
