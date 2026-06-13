'use strict';

const appDb = require('../../db/appDb');
const { getAvatarUrl } = require('../../utils/avatarHelper');
const { normalizeDigits } = require('../../utils/digitHelper');
const { logActivity, getClientIp } = require('./adminAuthController');
const { getUserEngagement } = require('../../utils/sessionHelper');

function parsePageLimit(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

function isSubscriptionActive(user) {
  if (!user.subscription_plan || !user.subscription_expires_at) return false;
  const exp = new Date(String(user.subscription_expires_at).slice(0, 10) + 'T23:59:59');
  return !Number.isNaN(exp.getTime()) && exp.getTime() > Date.now();
}

function subscriptionExpiresInDays(expiresAt) {
  if (!expiresAt) return null;
  const exp = new Date(String(expiresAt).slice(0, 10) + 'T23:59:59');
  if (Number.isNaN(exp.getTime())) return null;
  return Math.ceil((exp.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function mapListUser(row) {
  const user = {
    id: row.id,
    mobile: row.mobile,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    verification_level: row.verification_level,
    subscription_plan: row.subscription_plan,
    subscription_expires_at: row.subscription_expires_at,
    referred_by_code: row.referred_by_code,
    created_at: row.created_at,
    has_seen_stories: row.has_seen_stories,
    pending_verification: !!row.pending_verification,
    pending_subscription: !!row.pending_subscription,
  };
  user.is_subscription_active = isSubscriptionActive(user);
  return user;
}

function listUsers(req, res) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query);
    const {
      search,
      verification_level,
      subscription_plan,
      has_pending_verification,
      has_pending_subscription,
      sort = 'newest',
    } = req.query;

    const where = [];
    const params = [];

    if (search && String(search).trim()) {
      const raw = String(search).trim();
      const ascii = normalizeDigits(raw);
      const qRaw = `%${raw}%`;
      const qAscii = `%${ascii}%`;
      where.push(`(
        u.mobile LIKE ? OR u.mobile LIKE ? OR u.email LIKE ? OR
        IFNULL(u.first_name,'') LIKE ? OR IFNULL(u.last_name,'') LIKE ?
      )`);
      params.push(qRaw, qAscii, qRaw, qRaw, qRaw);
    }

    if (verification_level !== undefined && verification_level !== '') {
      where.push('u.verification_level = ?');
      params.push(Number(verification_level));
    }

    if (subscription_plan === 'none') {
      where.push(`(
        u.subscription_plan IS NULL OR u.subscription_expires_at IS NULL OR
        datetime(u.subscription_expires_at) <= datetime('now')
      )`);
    } else if (subscription_plan && ['silver', 'gold', 'diamond'].includes(subscription_plan)) {
      where.push(`u.subscription_plan = ? AND datetime(u.subscription_expires_at) > datetime('now')`);
      params.push(subscription_plan);
    }

    if (has_pending_verification === 'true') {
      where.push(`EXISTS (
        SELECT 1 FROM verification_requests vr
        WHERE vr.user_id = u.id AND vr.status = 'pending'
      )`);
    }

    if (has_pending_subscription === 'true') {
      where.push(`EXISTS (
        SELECT 1 FROM subscription_requests sr
        WHERE sr.user_id = u.id AND sr.status = 'pending'
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    let orderBy = 'u.created_at DESC';
    if (sort === 'oldest') orderBy = 'u.created_at ASC';
    if (sort === 'last_active') {
      orderBy = `COALESCE((
        SELECT MAX(s.last_ping_at) FROM user_app_sessions s WHERE s.user_id = u.id
      ), (
        SELECT MAX(d.last_active) FROM connected_devices d WHERE d.user_id = u.id
      )) DESC, u.created_at DESC`;
    }

    const { total } = appDb.prepare(
      `SELECT COUNT(*) AS total FROM users u ${whereSql}`
    ).get(...params);

    const rows = appDb.prepare(`
      SELECT u.id, u.mobile, u.email, u.first_name, u.last_name,
             u.verification_level, u.subscription_plan, u.subscription_expires_at,
             u.referred_by_code, u.has_seen_stories, u.created_at,
             EXISTS(
               SELECT 1 FROM verification_requests vr
               WHERE vr.user_id = u.id AND vr.status = 'pending'
             ) AS pending_verification,
             EXISTS(
               SELECT 1 FROM subscription_requests sr
               WHERE sr.user_id = u.id AND sr.status = 'pending'
             ) AS pending_subscription
      FROM users u
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return res.json({
      users: rows.map(mapListUser),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (err) {
    console.error('[adminUsers.listUsers]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function searchUsers(req, res) {
  try {
    const mobile = normalizeDigits(String(req.query.mobile || '').trim());
    if (!mobile) {
      return res.json({ users: [] });
    }
    const q = `%${mobile}%`;
    const rows = appDb.prepare(`
      SELECT id, mobile, email, first_name, last_name, verification_level, subscription_plan
      FROM users
      WHERE mobile LIKE ?
      ORDER BY mobile ASC
      LIMIT 20
    `).all(q);
    return res.json({ users: rows });
  } catch (err) {
    console.error('[adminUsers.searchUsers]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function getUserById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }

    const row = appDb.prepare(`
      SELECT id, mobile, email, first_name, last_name, national_id, birth_date,
             address, postal_code, verification_level,
             subscription_plan, subscription_expires_at,
             referred_by_code, referral_discount_count,
             avatar_type, avatar_seed, avatar_custom_path,
             first_login_message_sent, has_seen_stories, created_at
      FROM users WHERE id = ?
    `).get(id);

    if (!row) return res.status(404).json({ message: 'کاربر یافت نشد' });

    const user = {
      id: row.id,
      mobile: row.mobile,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      national_id: row.national_id,
      birth_date: row.birth_date,
      address: row.address,
      postal_code: row.postal_code,
      verification_level: row.verification_level,
      subscription_plan: row.subscription_plan,
      subscription_expires_at: row.subscription_expires_at,
      is_subscription_active: isSubscriptionActive(row),
      subscription_expires_in_days: subscriptionExpiresInDays(row.subscription_expires_at),
      referred_by_code: row.referred_by_code,
      referral_discount_count: row.referral_discount_count,
      avatar_type: row.avatar_type,
      avatar_seed: row.avatar_seed,
      avatar_url: getAvatarUrl(row),
      first_login_message_sent: row.first_login_message_sent,
      created_at: row.created_at,
    };

    const engagement = getUserEngagement(id);

    const verification_requests = appDb.prepare(`
      SELECT id, requested_level, status, admin_note, created_at, reviewed_at
      FROM verification_requests WHERE user_id = ?
      ORDER BY id DESC
    `).all(id);

    const subscription_requests = appDb.prepare(`
      SELECT id, plan, duration_months, status, admin_note, created_at, reviewed_at
      FROM subscription_requests WHERE user_id = ?
      ORDER BY id DESC
    `).all(id);

    const referralRow = appDb.prepare(`
      SELECT u.mobile, u.first_name, u.last_name
      FROM referrals r
      JOIN users u ON u.id = r.inviter_user_id
      WHERE r.invitee_user_id = ?
    `).get(id);

    const invited_by = referralRow
      ? {
          mobile: referralRow.mobile,
          name: [referralRow.first_name, referralRow.last_name].filter(Boolean).join(' ') || referralRow.mobile,
        }
      : null;

    const { invited_count } = appDb.prepare(
      'SELECT COUNT(*) AS invited_count FROM referrals WHERE inviter_user_id = ?'
    ).get(id);

    const { successful_referrals } = appDb.prepare(`
      SELECT COUNT(DISTINCT r.invitee_user_id) AS successful_referrals
      FROM referrals r
      JOIN subscription_requests sr ON sr.user_id = r.invitee_user_id AND sr.status = 'approved'
      WHERE r.inviter_user_id = ?
    `).get(id);

    const devices = appDb.prepare(`
      SELECT id, device_name, device_type, last_active, ip_address
      FROM connected_devices WHERE user_id = ?
      ORDER BY last_active DESC
    `).all(id);

    return res.json({
      user,
      engagement,
      verification_requests,
      subscription_requests,
      referrals: {
        invited_by,
        invited_count,
        successful_referrals,
      },
      devices,
    });
  } catch (err) {
    console.error('[adminUsers.getUserById]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function resetStoriesUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    const user = appDb.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ message: 'کاربر یافت نشد' });

    appDb.prepare('UPDATE users SET has_seen_stories = 0 WHERE id = ?').run(id);
    logActivity(req.session.adminId, 'reset_stories_user', {
      target_type: 'user',
      target_id: id,
      ip: getClientIp(req),
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[adminUsers.resetStoriesUser]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function resetStoriesAll(req, res) {
  try {
    const result = appDb.prepare('UPDATE users SET has_seen_stories = 0').run();
    logActivity(req.session.adminId, 'reset_stories_all', {
      ip: getClientIp(req),
      detail: { updated_count: result.changes },
    });
    return res.json({ success: true, updated_count: result.changes });
  } catch (err) {
    console.error('[adminUsers.resetStoriesAll]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listUsers,
  searchUsers,
  getUserById,
  resetStoriesUser,
  resetStoriesAll,
};
