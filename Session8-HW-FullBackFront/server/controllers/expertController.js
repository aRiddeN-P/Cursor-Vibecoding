'use strict';

const db = require('../db/appDb');
const push = require('../utils/pushHelper');

const VALID_TYPES = Object.freeze(['action', 'alert']);
const VALID_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'urgent']);
const VALID_STATUSES = Object.freeze(['pending', 'done', 'dismissed']);

const stmts = {
  selectUserSub: db.prepare(`
    SELECT subscription_plan, subscription_expires_at FROM users WHERE id = ?
  `),
  subscribedUsers: db.prepare(`
    SELECT id FROM users
     WHERE subscription_plan IS NOT NULL
       AND subscription_expires_at IS NOT NULL
       AND datetime(subscription_expires_at) > datetime('now')
  `),
  insertMessage: db.prepare(`
    INSERT INTO messages (user_id, title, body, type, related_id, expires_at)
    VALUES (?, ?, ?, 'system', ?, ?)
  `),
  listForUser: db.prepare(`
    SELECT er.*,
           COALESCE(urs.status, 'pending') AS user_status
      FROM expert_recommendations er
      LEFT JOIN user_recommendation_status urs
        ON urs.recommendation_id = er.id AND urs.user_id = ?
     WHERE er.is_active = 1
       AND (? = 0 OR (er.expires_at IS NULL OR datetime(er.expires_at) > datetime('now')))
       AND (? IS NULL OR er.type = ?)
     ORDER BY
       CASE er.priority
         WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3
       END,
       er.created_at DESC
  `),
  getOneForUser: db.prepare(`
    SELECT er.*,
           COALESCE(urs.status, 'pending') AS user_status
      FROM expert_recommendations er
      LEFT JOIN user_recommendation_status urs
        ON urs.recommendation_id = er.id AND urs.user_id = ?
     WHERE er.id = ? AND er.is_active = 1
     LIMIT 1
  `),
  getActiveById: db.prepare(`
    SELECT * FROM expert_recommendations WHERE id = ? AND is_active = 1 LIMIT 1
  `),
  upsertStatus: db.prepare(`
    INSERT INTO user_recommendation_status (user_id, recommendation_id, status, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, recommendation_id) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at
  `),
  adminCount: db.prepare(`
    SELECT COUNT(*) AS cnt FROM expert_recommendations
     WHERE (? IS NULL OR type = ?)
       AND (? IS NULL OR priority = ?)
       AND (? IS NULL OR is_active = ?)
  `),
  adminList: db.prepare(`
    SELECT er.*
      FROM expert_recommendations er
     WHERE (? IS NULL OR er.type = ?)
       AND (? IS NULL OR er.priority = ?)
       AND (? IS NULL OR er.is_active = ?)
     ORDER BY er.created_at DESC
     LIMIT ? OFFSET ?
  `),
  statusStats: db.prepare(`
    SELECT status, COUNT(*) AS cnt
      FROM user_recommendation_status
     WHERE recommendation_id = ?
     GROUP BY status
  `),
  insertRec: db.prepare(`
    INSERT INTO expert_recommendations
      (title, body, type, asset_key, asset_name, target_percent, priority, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getById: db.prepare('SELECT * FROM expert_recommendations WHERE id = ? LIMIT 1'),
  updateRec: db.prepare(`
    UPDATE expert_recommendations
       SET title = ?, body = ?, type = ?, asset_key = ?, asset_name = ?,
           target_percent = ?, priority = ?, expires_at = ?, is_active = ?,
           updated_at = datetime('now')
     WHERE id = ?
  `),
  deleteStatuses: db.prepare('DELETE FROM user_recommendation_status WHERE recommendation_id = ?'),
  deleteRec: db.prepare('DELETE FROM expert_recommendations WHERE id = ?'),
};

function userId(req) {
  return req.session.user_id;
}

function hasActiveSubscription(user) {
  if (!user || !user.subscription_plan || !user.subscription_expires_at) return false;
  const t = new Date(String(user.subscription_expires_at).slice(0, 10) + 'T23:59:59').getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now();
}

function requireSubscription(req, res) {
  const user = stmts.selectUserSub.get(userId(req));
  if (!hasActiveSubscription(user)) {
    res.status(403).json({ message: 'این بخش مخصوص کاربران دارای اشتراک فعال است' });
    return false;
  }
  return true;
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const t = new Date(String(expiresAt).replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

function shapeRecommendation(row) {
  const expired = isExpired(row.expires_at);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    asset_key: row.asset_key,
    asset_name: row.asset_name,
    target_percent: row.target_percent != null ? Number(row.target_percent) : null,
    priority: row.priority || 'medium',
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_active: row.is_active ? 1 : 0,
    user_status: row.user_status || 'pending',
    is_expired: expired,
  };
}

function countByStatus(recommendations, statusFilter) {
  const filtered = statusFilter === 'all'
    ? recommendations
    : recommendations.filter((r) => r.user_status === statusFilter);
  const counts = { total: recommendations.length, pending: 0, done: 0, dismissed: 0 };
  for (const r of recommendations) {
    if (counts[r.user_status] != null) counts[r.user_status] += 1;
  }
  return { items: filtered, counts };
}

function adminStats(recId) {
  const rows = stmts.statusStats.all(recId);
  const stats = { pending: 0, done: 0, dismissed: 0, total_users: 0 };
  for (const r of rows) {
    stats[r.status] = r.cnt;
    stats.total_users += r.cnt;
  }
  return stats;
}

function notifySubscribers(rec, recId) {
  setImmediate(() => {
    try {
      const users = stmts.subscribedUsers.all();
      const pushTitle = rec.priority === 'urgent' ? '🚨 پیشنهاد فوری' : '💡 پیشنهاد تخصصی جدید';
      const msgTitle = rec.priority === 'urgent' ? '🚨 پیشنهاد تخصصی فوری' : '💡 پیشنهاد تخصصی جدید';
      const msgBody = `${rec.title} — برای مشاهده جزئیات به بخش پیشنهاد تخصصی مراجعه کنید.`;
      const msgExpires = rec.expires_at || (() => {
        const d = new Date(Date.now() + 7 * 86400000);
        return d.toISOString().slice(0, 19).replace('T', ' ');
      })();

      for (const u of users) {
        try {
          stmts.insertMessage.run(u.id, msgTitle, msgBody, recId, msgExpires);
        } catch (err) {
          console.error('[expert.notify] message insert failed user', u.id, err.message);
        }
        push.sendPushAsync(u.id, {
          title: pushTitle,
          body: rec.title,
          tag: `expert-rec-${recId}`,
          requireInteraction: rec.priority === 'urgent',
          url: '/expert.html',
          message_id: null,
        });
      }
    } catch (err) {
      console.error('[expert.notify]', err.message);
    }
  });
}

function listRecommendationsEndpoint(req, res) {
  try {
    if (!requireSubscription(req, res)) return;
    const uid = userId(req);
    const statusFilter = String(req.query.status || 'all').toLowerCase();
    const typeFilter = req.query.type ? String(req.query.type).toLowerCase() : null;
    const onlyActive = String(req.query.only_active ?? 'true').toLowerCase() !== 'false';

    if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
      return res.status(400).json({ message: 'نوع فیلتر نامعتبر است' });
    }
    if (!['all', 'pending', 'done', 'dismissed'].includes(statusFilter)) {
      return res.status(400).json({ message: 'وضعیت فیلتر نامعتبر است' });
    }

    const rows = stmts.listForUser.all(uid, onlyActive ? 1 : 0, typeFilter, typeFilter);
    const shaped = rows.map(shapeRecommendation);
    const { items, counts } = countByStatus(shaped, statusFilter);

    return res.json({ recommendations: items, counts });
  } catch (err) {
    console.error('[expert.list]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function getRecommendationEndpoint(req, res) {
  try {
    if (!requireSubscription(req, res)) return;
    const id = Number(req.params.id);
    const row = stmts.getOneForUser.get(userId(req), id);
    if (!row) return res.status(404).json({ message: 'پیشنهاد یافت نشد' });
    return res.json({ recommendation: shapeRecommendation(row) });
  } catch (err) {
    console.error('[expert.get]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function patchStatusEndpoint(req, res) {
  try {
    if (!requireSubscription(req, res)) return;
    const id = Number(req.params.id);
    const status = String((req.body || {}).status || '').toLowerCase();
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'وضعیت نامعتبر است' });
    }
    const rec = stmts.getActiveById.get(id);
    if (!rec) return res.status(404).json({ message: 'پیشنهاد یافت نشد' });
    stmts.upsertStatus.run(userId(req), id, status);
    return res.json({ success: true, status });
  } catch (err) {
    console.error('[expert.patchStatus]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function adminListEndpoint(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const type = req.query.type ? String(req.query.type).toLowerCase() : null;
    const priority = req.query.priority ? String(req.query.priority).toLowerCase() : null;
    let isActive = null;
    if (req.query.is_active != null) {
      isActive = String(req.query.is_active).toLowerCase() === 'true' || req.query.is_active === '1' ? 1 : 0;
    }

    const total = stmts.adminCount.get(type, type, priority, priority, isActive, isActive).cnt;
    const rows = stmts.adminList.all(type, type, priority, priority, isActive, isActive, limit, offset);
    const recommendations = rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      type: row.type,
      asset_key: row.asset_key,
      asset_name: row.asset_name,
      target_percent: row.target_percent != null ? Number(row.target_percent) : null,
      priority: row.priority,
      is_active: row.is_active ? 1 : 0,
      expires_at: row.expires_at,
      created_at: row.created_at,
      stats: adminStats(row.id),
    }));

    return res.json({ recommendations, total, page, limit });
  } catch (err) {
    console.error('[expert.adminList]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function adminCreateEndpoint(req, res) {
  try {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const recBody = String(body.body || '').trim();
    const type = String(body.type || '').toLowerCase();

    if (!title || title.length > 80) {
      return res.status(422).json({ message: 'عنوان نمی‌تواند بیش از ۸۰ کاراکتر باشد' });
    }
    if (!recBody || recBody.length > 1000) {
      return res.status(422).json({ message: 'متن پیشنهاد نمی‌تواند بیش از ۱۰۰۰ کاراکتر باشد' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ message: 'نوع پیشنهاد نامعتبر است' });
    }

    const priority = VALID_PRIORITIES.includes(String(body.priority || '').toLowerCase())
      ? String(body.priority).toLowerCase()
      : 'medium';
    const targetPercent = body.target_percent != null && body.target_percent !== ''
      ? Number(body.target_percent)
      : null;
    const expiresAt = body.expires_at ? String(body.expires_at).trim() : null;

    const info = stmts.insertRec.run(
      title,
      recBody,
      type,
      body.asset_key ? String(body.asset_key).trim() : null,
      body.asset_name ? String(body.asset_name).trim() : null,
      Number.isFinite(targetPercent) ? targetPercent : null,
      priority,
      expiresAt
    );

    const rec = stmts.getById.get(Number(info.lastInsertRowid));
    notifySubscribers(rec, rec.id);

    return res.status(201).json({
      success: true,
      recommendation: shapeRecommendation({ ...rec, user_status: 'pending' }),
    });
  } catch (err) {
    console.error('[expert.adminCreate]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function adminPatchEndpoint(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = stmts.getById.get(id);
    if (!existing) return res.status(404).json({ message: 'پیشنهاد یافت نشد' });

    const body = req.body || {};
    const title = body.title != null ? String(body.title).trim() : existing.title;
    const recBody = body.body != null ? String(body.body).trim() : existing.body;
    const type = body.type != null ? String(body.type).toLowerCase() : existing.type;

    if (title.length > 80) {
      return res.status(422).json({ message: 'عنوان نمی‌تواند بیش از ۸۰ کاراکتر باشد' });
    }
    if (recBody.length > 1000) {
      return res.status(422).json({ message: 'متن پیشنهاد نمی‌تواند بیش از ۱۰۰۰ کاراکتر باشد' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ message: 'نوع پیشنهاد نامعتبر است' });
    }

    const priority = body.priority != null
      ? (VALID_PRIORITIES.includes(String(body.priority).toLowerCase()) ? String(body.priority).toLowerCase() : existing.priority)
      : existing.priority;
    const targetPercent = body.target_percent !== undefined
      ? (body.target_percent == null || body.target_percent === '' ? null : Number(body.target_percent))
      : existing.target_percent;
    const expiresAt = body.expires_at !== undefined ? (body.expires_at || null) : existing.expires_at;
    const isActive = body.is_active !== undefined
      ? (body.is_active === 1 || body.is_active === true || body.is_active === '1' ? 1 : 0)
      : existing.is_active;

    stmts.updateRec.run(
      title,
      recBody,
      type,
      body.asset_key !== undefined ? (body.asset_key || null) : existing.asset_key,
      body.asset_name !== undefined ? (body.asset_name || null) : existing.asset_name,
      Number.isFinite(Number(targetPercent)) ? Number(targetPercent) : null,
      priority,
      expiresAt,
      isActive,
      id
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[expert.adminPatch]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function adminDeleteEndpoint(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = stmts.getById.get(id);
    if (!existing) return res.status(404).json({ message: 'پیشنهاد یافت نشد' });
    const tx = db.transaction(() => {
      stmts.deleteStatuses.run(id);
      stmts.deleteRec.run(id);
    });
    tx();
    return res.json({ success: true });
  } catch (err) {
    console.error('[expert.adminDelete]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listRecommendationsEndpoint,
  getRecommendationEndpoint,
  patchStatusEndpoint,
  adminListEndpoint,
  adminCreateEndpoint,
  adminPatchEndpoint,
  adminDeleteEndpoint,
};
