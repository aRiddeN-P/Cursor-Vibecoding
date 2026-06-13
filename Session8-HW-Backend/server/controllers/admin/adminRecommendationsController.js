'use strict';

const appDb = require('../../db/appDb');
const expertCtrl = require('../../controllers/expertController');
const { logActivity, getClientIp } = require('./adminAuthController');

const stmts = {
  statusStats: appDb.prepare(`
    SELECT status, COUNT(*) AS cnt FROM user_recommendation_status
    WHERE recommendation_id = ? GROUP BY status
  `),
  doneUsers: appDb.prepare(`
    SELECT u.id, u.mobile, u.first_name, u.last_name, urs.updated_at
    FROM user_recommendation_status urs
    JOIN users u ON u.id = urs.user_id
    WHERE urs.recommendation_id = ? AND urs.status = 'done'
    ORDER BY urs.updated_at DESC
    LIMIT 50
  `),
  subscriberCount: appDb.prepare(`
    SELECT COUNT(*) AS cnt FROM users
    WHERE subscription_plan IS NOT NULL
      AND subscription_expires_at IS NOT NULL
      AND datetime(subscription_expires_at) > datetime('now')
  `),
};

function wrapJson(res, req, action, getTargetId) {
  const orig = res.json.bind(res);
  res.json = (body) => {
    if (body && body.success) {
      logActivity(req.session.adminId, action, {
        target_type: 'recommendation',
        target_id: getTargetId(body, req),
        ip: getClientIp(req),
      });
    }
    return orig(body);
  };
}

function listRecommendations(req, res) {
  return expertCtrl.adminListEndpoint(req, res);
}

function createRecommendation(req, res) {
  wrapJson(res, req, 'create_recommendation', (body) => body.recommendation?.id);
  return expertCtrl.adminCreateEndpoint(req, res);
}

function patchRecommendation(req, res) {
  wrapJson(res, req, 'update_recommendation', (_body, r) => Number(r.params.id));
  return expertCtrl.adminPatchEndpoint(req, res);
}

function deleteRecommendation(req, res) {
  wrapJson(res, req, 'delete_recommendation', (_body, r) => Number(r.params.id));
  return expertCtrl.adminDeleteEndpoint(req, res);
}

function getRecommendationStats(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    const rows = stmts.statusStats.all(id);
    const stats = { pending: 0, done: 0, dismissed: 0, total_users: 0 };
    for (const r of rows) {
      stats[r.status] = r.cnt;
      stats.total_users += r.cnt;
    }
    const done_users = stmts.doneUsers.all(id).map((u) => ({
      id: u.id,
      mobile: u.mobile,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.mobile,
      updated_at: u.updated_at,
    }));
    return res.json({ stats, done_users });
  } catch (err) {
    console.error('[adminRecommendations.getStats]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function getSubscriberCount(_req, res) {
  try {
    const { cnt } = stmts.subscriberCount.get();
    return res.json({ count: cnt });
  } catch (err) {
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listRecommendations,
  createRecommendation,
  patchRecommendation,
  deleteRecommendation,
  getRecommendationStats,
  getSubscriberCount,
};
