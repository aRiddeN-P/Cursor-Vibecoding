'use strict';

const appDb = require('../../db/appDb');
const adminDb = require('../../db/adminDb');
const { toPersianDigits, persianTimeAgo } = require('../../utils/timeHelper');
const { PLANS } = require('../../utils/plans');
const {
  getOverviewEngagement,
  getEngagementByMonth,
} = require('../../utils/sessionHelper');
const { getTodayBannerStats } = require('../bannersController');

function persianMonthLabel(isoMonth) {
  const [y, m] = isoMonth.split('-').map(Number);
  const d = new Date(y, m - 1, 15);
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoMonth;
  }
}

function getLastMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  }
  return months;
}

function bannerStatus(row) {
  if (!row.is_active) return 'disabled';
  const now = new Date().toISOString();
  if (row.ends_at < now) return 'expired';
  if (row.starts_at > now) return 'scheduled';
  return 'active';
}

function overview(_req, res) {
  try {
    const users = appDb.prepare(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total,
        (SELECT COUNT(*) FROM users WHERE date(created_at) = date('now')) AS new_today,
        (SELECT COUNT(*) FROM users WHERE date(created_at) >= date('now', '-7 days')) AS new_this_week,
        (SELECT COUNT(*) FROM users WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')) AS new_this_month,
        (SELECT COUNT(*) FROM users WHERE referred_by_code IS NOT NULL AND referred_by_code != '') AS with_referral
    `).get();

    const engagement = getOverviewEngagement();

    const verifLevels = appDb.prepare(`
      SELECT verification_level AS lvl, COUNT(*) AS cnt
      FROM users GROUP BY verification_level
    `).all();
    const levelMap = { 0: 0, 1: 0, 2: 0, 3: 0 };
    verifLevels.forEach((r) => {
      levelMap[r.lvl] = r.cnt;
    });

    const verifStats = appDb.prepare(`
      SELECT
        (SELECT COUNT(*) FROM verification_requests WHERE status = 'pending') AS pending_requests,
        (SELECT COUNT(*) FROM verification_requests
          WHERE status = 'approved' AND strftime('%Y-%m', reviewed_at) = strftime('%Y-%m', 'now')) AS approved_this_month,
        (SELECT COUNT(*) FROM verification_requests
          WHERE status = 'rejected' AND strftime('%Y-%m', reviewed_at) = strftime('%Y-%m', 'now')) AS rejected_this_month
    `).get();

    const subByPlan = appDb.prepare(`
      SELECT subscription_plan AS plan, COUNT(*) AS cnt
      FROM users
      WHERE subscription_plan IS NOT NULL
        AND subscription_expires_at IS NOT NULL
        AND datetime(subscription_expires_at) > datetime('now')
      GROUP BY subscription_plan
    `).all();
    const planCounts = { silver: 0, gold: 0, diamond: 0 };
    subByPlan.forEach((r) => {
      if (planCounts[r.plan] !== undefined) planCounts[r.plan] = r.cnt;
    });

    const subStats = appDb.prepare(`
      SELECT
        (SELECT COUNT(*) FROM users
          WHERE subscription_plan IS NOT NULL
            AND subscription_expires_at IS NOT NULL
            AND datetime(subscription_expires_at) > datetime('now')) AS active,
        (SELECT COUNT(*) FROM users
          WHERE subscription_expires_at IS NOT NULL
            AND strftime('%Y-%m', subscription_expires_at) = strftime('%Y-%m', 'now')
            AND datetime(subscription_expires_at) <= datetime('now')) AS expired_this_month,
        (SELECT COUNT(*) FROM subscription_requests
          WHERE status = 'approved'
            AND strftime('%Y-%m', reviewed_at) = strftime('%Y-%m', 'now')) AS new_this_month,
        (SELECT COUNT(*) FROM subscription_requests WHERE status = 'pending') AS pending_requests,
        (SELECT COALESCE(SUM(COALESCE(final_price, price)), 0) FROM subscription_requests
          WHERE status = 'approved'
            AND strftime('%Y-%m', reviewed_at) = strftime('%Y-%m', 'now')) AS revenue_this_month
    `).get();

    const bannerAgg = adminDb.prepare(`
      SELECT
        SUM(CASE WHEN is_active = 1 AND datetime(starts_at) <= datetime('now') AND datetime(ends_at) >= datetime('now') THEN 1 ELSE 0 END) AS active_now,
        COALESCE(SUM(impression_count), 0) AS total_impressions,
        COALESCE(SUM(click_count), 0) AS total_clicks
      FROM banners
    `).get();

    const overallCtr =
      bannerAgg.total_impressions > 0
        ? Math.round((bannerAgg.total_clicks / bannerAgg.total_impressions) * 10000) / 100
        : 0;

    const bannerToday = getTodayBannerStats();

    return res.json({
      users: {
        total: users.total,
        new_today: users.new_today,
        new_this_week: users.new_this_week,
        new_this_month: users.new_this_month,
        with_referral: users.with_referral,
      },
      verification: {
        level_0: levelMap[0] || 0,
        level_1: levelMap[1] || 0,
        level_2: levelMap[2] || 0,
        level_3: levelMap[3] || 0,
        pending_requests: verifStats.pending_requests,
        approved_this_month: verifStats.approved_this_month,
        rejected_this_month: verifStats.rejected_this_month,
      },
      subscriptions: {
        active: subStats.active,
        none: Math.max(0, (users.total || 0) - (subStats.active || 0)),
        silver: planCounts.silver,
        gold: planCounts.gold,
        diamond: planCounts.diamond,
        expired_this_month: subStats.expired_this_month,
        new_this_month: subStats.new_this_month,
        pending_requests: subStats.pending_requests,
        revenue_this_month: subStats.revenue_this_month,
      },
      engagement,
      banners: {
        active_now: bannerAgg.active_now || 0,
        total_impressions_today: bannerToday.impressions,
        total_clicks_today: bannerToday.clicks,
        overall_ctr: overallCtr,
      },
    });
  } catch (err) {
    console.error('[adminStats.overview]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function growth(_req, res) {
  try {
    const months = getLastMonths(6);
    const countUsers = appDb.prepare(`
      SELECT COUNT(*) AS cnt FROM users
      WHERE strftime('%Y-%m', created_at) = ?
    `);
    const countSubs = appDb.prepare(`
      SELECT COUNT(*) AS cnt FROM subscription_requests
      WHERE status = 'approved' AND strftime('%Y-%m', reviewed_at) = ?
    `);
    const countActive = appDb.prepare(`
      SELECT COUNT(DISTINCT user_id) AS cnt FROM user_app_sessions
      WHERE strftime('%Y-%m', last_ping_at) = ?
    `);

    const result = months.map((month) => ({
      month,
      month_label: persianMonthLabel(month),
      new_users: countUsers.get(month).cnt,
      new_subscriptions: countSubs.get(month).cnt,
      active_users: countActive.get(month).cnt,
    }));

    return res.json({ months: result });
  } catch (err) {
    console.error('[adminStats.growth]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function subscriptionRevenue(req, res) {
  try {
    const monthsParam = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
    const months = getLastMonths(monthsParam);

    const countByPlan = appDb.prepare(`
      SELECT plan, COUNT(*) AS cnt FROM subscription_requests
      WHERE status = 'approved' AND strftime('%Y-%m', reviewed_at) = ?
      GROUP BY plan
    `);
    const sumRevenue = appDb.prepare(`
      SELECT COALESCE(SUM(COALESCE(final_price, price)), 0) AS total
      FROM subscription_requests
      WHERE status = 'approved' AND strftime('%Y-%m', reviewed_at) = ?
    `);

    let totalRevenue6m = 0;
    const result = months.map((month) => {
      const byPlan = countByPlan.all(month);
      const planCounts = { silver: 0, gold: 0, diamond: 0 };
      byPlan.forEach((r) => {
        if (planCounts[r.plan] !== undefined) planCounts[r.plan] = r.cnt;
      });
      const totalRevenue = sumRevenue.get(month).total;
      totalRevenue6m += totalRevenue;
      const totalCount = planCounts.silver + planCounts.gold + planCounts.diamond;
      return {
        month,
        month_label: persianMonthLabel(month),
        silver_count: planCounts.silver,
        gold_count: planCounts.gold,
        diamond_count: planCounts.diamond,
        total_revenue: totalRevenue,
        total_count: totalCount,
      };
    });

    return res.json({
      months: result,
      total_revenue_6m: totalRevenue6m,
      avg_monthly_revenue:
        months.length > 0 ? Math.round(totalRevenue6m / months.length) : 0,
    });
  } catch (err) {
    console.error('[adminStats.subscriptionRevenue]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function engagementTrend(_req, res) {
  try {
    const months = getLastMonths(6);
    const rows = getEngagementByMonth(months);
    const result = rows.map((row) => ({
      ...row,
      month_label: persianMonthLabel(row.month),
    }));
    return res.json({ months: result });
  } catch (err) {
    console.error('[adminStats.engagementTrend]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function activityLog(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const adminId = req.query.admin_id ? Number(req.query.admin_id) : null;

    let where = '';
    const params = [];
    if (adminId && Number.isInteger(adminId)) {
      where = 'WHERE al.admin_id = ?';
      params.push(adminId);
    }

    const { total } = adminDb.prepare(
      `SELECT COUNT(*) AS total FROM admin_activity_log al ${where}`
    ).get(...params);

    const logs = adminDb.prepare(`
      SELECT al.id, a.username AS admin_username, al.action, al.target_type,
             al.target_id, al.detail, al.ip_address, al.created_at
      FROM admin_activity_log al
      JOIN admins a ON a.id = al.admin_id
      ${where}
      ORDER BY al.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return res.json({ logs, total, page, limit });
  } catch (err) {
    console.error('[adminStats.activityLog]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function pendingVerifications(_req, res) {
  try {
    const rows = appDb.prepare(`
      SELECT vr.id, vr.user_id, vr.requested_level, vr.status, vr.created_at,
             u.mobile, u.verification_level
      FROM verification_requests vr
      JOIN users u ON u.id = vr.user_id
      WHERE vr.status = 'pending'
      ORDER BY vr.id ASC
      LIMIT 5
    `).all();
    return res.json({ requests: rows });
  } catch (err) {
    console.error('[adminStats.pendingVerifications]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function pendingSubscriptions(_req, res) {
  try {
    const rows = appDb.prepare(`
      SELECT sr.id, sr.user_id, sr.plan, sr.created_at,
             u.mobile
      FROM subscription_requests sr
      JOIN users u ON u.id = sr.user_id
      WHERE sr.status = 'pending'
      ORDER BY sr.id ASC
      LIMIT 5
    `).all();
    return res.json({ requests: rows });
  } catch (err) {
    console.error('[adminStats.pendingSubscriptions]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function listBanners(_req, res) {
  try {
    const rows = adminDb.prepare(`
      SELECT id, title, starts_at, ends_at, is_active,
             impression_count, click_count
      FROM banners
      ORDER BY display_order ASC, id DESC
    `).all();

    const banners = rows.map((row) => {
      const status = bannerStatus(row);
      const ctr =
        row.impression_count > 0
          ? Math.round((row.click_count / row.impression_count) * 10000) / 100
          : 0;
      return {
        id: row.id,
        title: row.title,
        status,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        impressions: row.impression_count,
        clicks: row.click_count,
        ctr,
      };
    });

    return res.json({ banners });
  } catch (err) {
    console.error('[adminStats.listBanners]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function actionLabel(action, detail) {
  const labels = {
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
  if (labels[action]) return labels[action];
  return action;
}

module.exports = {
  overview,
  growth,
  subscriptionRevenue,
  engagementTrend,
  activityLog,
  pendingVerifications,
  pendingSubscriptions,
  listBanners,
  actionLabel,
  persianMonthLabel,
  toPersianDigits,
  persianTimeAgo,
  PLANS,
};
