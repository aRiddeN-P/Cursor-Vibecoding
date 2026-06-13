(function () {
  'use strict';

  const PLAN_NAMES = { silver: 'نقره‌ای', gold: 'طلایی', diamond: 'الماسی' };
  const STATUS_BADGE = {
    active: ['green', 'فعال'],
    scheduled: ['blue', 'زمان‌بندی'],
    expired: ['gray', 'منقضی'],
    disabled: ['red', 'غیرفعال'],
  };

  const KPI_COLORS = {
    blue: '#EFF6FF',
    gold: '#FFFBEB',
    green: '#ECFDF5',
    purple: '#F5F3FF',
    orange: '#FFF7ED',
    teal: '#F0FDFA',
  };

  let overviewData = null;
  let refreshTimer = null;

  function fmt(n) {
    return AdminAPI.pd(Number(n || 0).toLocaleString('en'));
  }

  function renderKpis(data) {
    const grid = document.getElementById('kpi-grid');
    if (!grid || !data) return;

    const verified = (data.verification.level_1 || 0) +
      (data.verification.level_2 || 0) + (data.verification.level_3 || 0);

    const cards = [
      {
        label: 'کاربران کل',
        icon: '👥',
        color: 'blue',
        value: data.users.total,
        sub: `+${fmt(data.users.new_today)} امروز`,
        subClass: 'up',
      },
      {
        label: 'اشتراک فعال',
        icon: '💎',
        color: 'gold',
        value: data.subscriptions.active,
        sub: `${fmt(data.subscriptions.pending_requests)} در انتظار تایید`,
      },
      {
        label: 'احراز هویت',
        icon: '✅',
        color: 'green',
        value: verified,
        sub: `${fmt(data.verification.pending_requests)} درخواست در انتظار`,
      },
      {
        label: 'کاربران فعال (۳۰ روز)',
        icon: '📱',
        color: 'purple',
        value: data.engagement?.mau || 0,
        sub: `${fmt(data.engagement?.wau || 0)} در ۷ روز اخیر`,
      },
      {
        label: 'بنرها',
        icon: '📢',
        color: 'orange',
        value: data.banners.active_now,
        sub: `${fmt(data.banners.total_clicks_today)} کلیک امروز`,
      },
      {
        label: 'میانگین حضور در اپ',
        icon: '⏱',
        color: 'teal',
        value: data.engagement?.avg_session_minutes || 0,
        sub: `${fmt(data.engagement?.sessions_30d || 0)} نشست در ۳۰ روز — دقیقه`,
      },
    ];

    grid.innerHTML = cards.map(c => `
      <div class="admin-kpi-card">
        <div class="admin-kpi-header">
          <span class="admin-kpi-label">${c.label}</span>
          <span class="admin-kpi-icon" style="background:${KPI_COLORS[c.color]}">${c.icon}</span>
        </div>
        <div class="admin-kpi-value">${fmt(c.value)}</div>
        <div class="admin-kpi-sub ${c.subClass || ''}">${c.sub}</div>
      </div>
    `).join('');
  }

  function renderGrowthChart(months) {
    if (!months || !months.length) return;
    const labels = months.map(m => {
      const parts = m.month_label.split(' ');
      return parts[0] || m.month;
    });
    drawAdminLineChart('chart-growth', months.map((m, i) => ({
      label: labels[i],
      value: m.new_users,
    })), { lineColor: '#1A5C3A' });
  }

  function renderVerificationChart(v) {
    drawAdminDonutChart('chart-verification', [
      { label: 'سطح ۰', value: v.level_0, color: '#94A3B8' },
      { label: 'سطح ۱', value: v.level_1, color: '#2563EB' },
      { label: 'سطح ۲', value: v.level_2, color: '#7C3AED' },
      { label: 'سطح ۳', value: v.level_3, color: '#059669' },
    ], { centerLabel: 'کاربران', centerValue: v.level_0 + v.level_1 + v.level_2 + v.level_3 });
  }

  function renderSubscriptionChart(s, usersTotal) {
    const total = (s.none || 0) + (s.silver || 0) + (s.gold || 0) + (s.diamond || 0);
    drawAdminDonutChart('chart-subscriptions', [
      { label: 'بدون اشتراک', value: s.none || 0, color: '#CBD5E1' },
      { label: 'نقره‌ای', value: s.silver || 0, color: '#94A3B8' },
      { label: 'طلایی', value: s.gold || 0, color: '#F0B429' },
      { label: 'الماسی', value: s.diamond || 0, color: '#7C3AED' },
    ], { centerLabel: 'کاربران', centerValue: total || usersTotal || 0 });
  }

  function renderEngagementTrend(months) {
    const el = document.getElementById('engagement-trend-list');
    if (!el) return;
    if (!months || !months.length) {
      el.innerHTML = '<p class="admin-empty-msg">داده‌ای موجود نیست</p>';
      return;
    }
    const maxActive = Math.max(...months.map(m => m.active_users || 0), 1);
    el.innerHTML = months.map(m => {
      const pct = Math.round(((m.active_users || 0) / maxActive) * 100);
      return `
      <div class="admin-cat-bar-item">
        <span class="admin-cat-bar-name">${m.month_label}</span>
        <div class="admin-cat-bar-wrap">
          <div class="admin-cat-bar-fill" style="width:${pct}%;background:#1A5C3A"></div>
        </div>
        <span class="admin-cat-bar-pct">${fmt(m.active_users)} کاربر</span>
        <span class="admin-cat-bar-count">(${fmt(m.sessions)} نشست)</span>
      </div>
    `;
    }).join('');
  }

  function renderPendingVerifications(requests) {
    const list = document.getElementById('pending-verif-list');
    const badge = document.getElementById('pending-verif-count');
    if (badge) badge.textContent = AdminAPI.pd(overviewData?.verification?.pending_requests || requests.length);
    if (!list) return;
    if (!requests.length) {
      list.innerHTML = '<p class="admin-empty-msg">درخواستی در انتظار نیست</p>';
      return;
    }
    list.innerHTML = requests.map(r => `
      <div class="admin-pending-item" data-id="${r.id}">
        <span class="admin-pending-mobile">${r.mobile}</span>
        <span class="admin-pending-meta">سطح ${AdminAPI.pd(r.requested_level)}</span>
        <span class="admin-pending-meta">${AdminAPI.formatDate(r.created_at)}</span>
        <div class="admin-pending-actions">
          <button type="button" class="admin-btn success sm btn-verif-approve" data-id="${r.id}">تایید</button>
          <button type="button" class="admin-btn danger sm btn-verif-reject" data-id="${r.id}">رد</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-verif-approve').forEach(btn => {
      btn.addEventListener('click', () => handleVerifAction(btn.dataset.id, 'approve'));
    });
    list.querySelectorAll('.btn-verif-reject').forEach(btn => {
      btn.addEventListener('click', () => handleVerifAction(btn.dataset.id, 'reject'));
    });
  }

  function renderPendingSubscriptions(requests) {
    const list = document.getElementById('pending-sub-list');
    const badge = document.getElementById('pending-sub-count');
    if (badge) badge.textContent = AdminAPI.pd(overviewData?.subscriptions?.pending_requests || requests.length);
    if (!list) return;
    if (!requests.length) {
      list.innerHTML = '<p class="admin-empty-msg">درخواستی در انتظار نیست</p>';
      return;
    }
    list.innerHTML = requests.map(r => `
      <div class="admin-pending-item">
        <span class="admin-pending-mobile">${r.mobile}</span>
        <span class="admin-pending-meta">${PLAN_NAMES[r.plan] || r.plan}</span>
        <span class="admin-pending-meta">${AdminAPI.formatDate(r.created_at)}</span>
        <div class="admin-pending-actions">
          <button type="button" class="admin-btn success sm btn-sub-approve" data-id="${r.id}">تایید</button>
          <button type="button" class="admin-btn danger sm btn-sub-reject" data-id="${r.id}">رد</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-sub-approve').forEach(btn => {
      btn.addEventListener('click', () => handleSubAction(btn.dataset.id, 'approve'));
    });
    list.querySelectorAll('.btn-sub-reject').forEach(btn => {
      btn.addEventListener('click', () => handleSubAction(btn.dataset.id, 'reject'));
    });
  }

  async function handleVerifAction(id, action) {
    const path = `/api/admin/stats/pending-verifications/${id}/${action}`;
    try {
      await AdminAPI.post(path, action === 'reject' ? { note: 'رد از داشبورد' } : {});
      AdminAPI.showToast(action === 'approve' ? 'احراز تایید شد' : 'احراز رد شد');
      await loadPending();
      await refreshOverview();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  async function handleSubAction(id, action) {
    const path = `/api/admin/stats/pending-subscriptions/${id}/${action}`;
    try {
      await AdminAPI.post(path, action === 'reject' ? { note: 'رد از داشبورد' } : {});
      AdminAPI.showToast(action === 'approve' ? 'اشتراک تایید شد' : 'اشتراک رد شد');
      await loadPending();
      await refreshOverview();
    } catch (err) {
      AdminAPI.showToast(err.message || 'خطا', 'error');
    }
  }

  function renderBannerStats(banners, overview) {
    const el = document.getElementById('banner-stats');
    if (!el) return;

    const summary = `
      <div class="admin-banner-stats-grid">
        <div class="admin-banner-stat-box">
          <div class="label">بنر فعال</div>
          <div class="value">${fmt(overview.banners.active_now)}</div>
        </div>
        <div class="admin-banner-stat-box">
          <div class="label">CTR کلی</div>
          <div class="value">${AdminAPI.pd(overview.banners.overall_ctr)}٪</div>
        </div>
        <div class="admin-banner-stat-box">
          <div class="label">نمایش امروز</div>
          <div class="value">${fmt(overview.banners.total_impressions_today)}</div>
        </div>
        <div class="admin-banner-stat-box">
          <div class="label">کلیک امروز</div>
          <div class="value">${fmt(overview.banners.total_clicks_today)}</div>
        </div>
      </div>
    `;

    if (!banners.length) {
      el.innerHTML = summary + '<p class="admin-empty-msg">بنری ثبت نشده است</p>';
      return;
    }

    const rows = banners.map(b => {
      const [cls, label] = STATUS_BADGE[b.status] || ['gray', b.status];
      return `
        <tr>
          <td>${b.title}</td>
          <td><span class="admin-badge ${cls}">${label}</span></td>
          <td>${AdminAPI.formatDate(b.starts_at)} — ${AdminAPI.formatDate(b.ends_at)}</td>
          <td>${fmt(b.impressions)}</td>
          <td>${fmt(b.clicks)}</td>
          <td>${AdminAPI.pd(b.ctr)}٪</td>
        </tr>
      `;
    }).join('');

    el.innerHTML = summary + `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>عنوان</th>
              <th>وضعیت</th>
              <th>بازه</th>
              <th>نمایش</th>
              <th>کلیک</th>
              <th>CTR</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  async function refreshOverview() {
    overviewData = await AdminAPI.get('/api/admin/stats/overview');
    renderKpis(overviewData);
    renderVerificationChart(overviewData.verification);
    renderSubscriptionChart(overviewData.subscriptions, overviewData.users?.total);
    return overviewData;
  }

  async function loadPending() {
    const [verif, sub] = await Promise.all([
      AdminAPI.get('/api/admin/stats/pending-verifications'),
      AdminAPI.get('/api/admin/stats/pending-subscriptions'),
    ]);
    renderPendingVerifications(verif.requests || []);
    renderPendingSubscriptions(sub.requests || []);
  }

  async function loadDashboard() {
    try {
      const [overview, growth, engagement, banners] = await Promise.all([
        refreshOverview(),
        AdminAPI.get('/api/admin/stats/growth'),
        AdminAPI.get('/api/admin/stats/engagement-trend'),
        AdminAPI.get('/api/admin/stats/banners'),
      ]);

      renderGrowthChart(growth.months || []);
      renderEngagementTrend(engagement.months || []);
      renderBannerStats(banners.banners || [], overview);
      await loadPending();
    } catch (err) {
      if (err.message !== 'unauthorized') {
        AdminAPI.showToast(err.message || 'خطا در بارگذاری داشبورد', 'error');
      }
    }
  }

  initAdminLayout('dashboard');
  loadDashboard();

  refreshTimer = setInterval(async () => {
    try {
      await refreshOverview();
    } catch (_) { /* ignore background refresh errors */ }
  }, 5 * 60 * 1000);

  window.addEventListener('beforeunload', () => {
    if (refreshTimer) clearInterval(refreshTimer);
  });
})();
