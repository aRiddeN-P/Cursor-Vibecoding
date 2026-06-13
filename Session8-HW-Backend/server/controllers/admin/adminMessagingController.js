'use strict';

const appDb = require('../../db/appDb');
const adminDb = require('../../db/adminDb');
const push = require('../../utils/pushHelper');
const { parseMobileImport } = require('../../utils/mobileImportHelper');
const { insertMessage } = require('../messagesController');
const { logActivity, getClientIp } = require('./adminAuthController');

const stmts = {
  allUsers: appDb.prepare('SELECT id FROM users'),
  userById: appDb.prepare(`
    SELECT id, mobile, first_name, last_name, subscription_plan, subscription_expires_at
    FROM users WHERE id = ?
  `),
  subscribedUsers: appDb.prepare(`
    SELECT id, mobile FROM users
    WHERE subscription_plan IS NOT NULL
      AND subscription_expires_at IS NOT NULL
      AND datetime(subscription_expires_at) > datetime('now')
  `),
  insertBroadcast: appDb.prepare(`
    INSERT INTO messages (user_id, title, body, type, related_id, expires_at)
    VALUES (?, ?, ?, 'admin_broadcast', NULL, ?)
  `),
  adminListBroadcasts: appDb.prepare(`
    SELECT MIN(id) AS id, title, body, type, expires_at,
           MIN(datetime(created_at)) AS created_at,
           COUNT(*) AS sent_count,
           SUM(is_read) AS read_count
    FROM messages
    WHERE type = 'admin_broadcast'
    GROUP BY title, body, type, expires_at, datetime(created_at)
    ORDER BY MIN(id) DESC
  `),
  adminListDirects: appDb.prepare(`
    SELECT m.id, m.title, m.body, m.type, m.expires_at, m.created_at,
           1 AS sent_count, m.is_read AS read_count,
           m.user_id, u.mobile AS user_mobile
    FROM messages m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.type = 'admin_direct'
    ORDER BY m.id DESC
  `),
  recById: appDb.prepare('SELECT * FROM expert_recommendations WHERE id = ? LIMIT 1'),
  insertRecStatus: appDb.prepare(`
    INSERT INTO user_recommendation_status (user_id, recommendation_id, status, updated_at)
    VALUES (?, ?, 'pending', datetime('now'))
    ON CONFLICT(user_id, recommendation_id) DO NOTHING
  `),
  statusStats: appDb.prepare(`
    SELECT status, COUNT(*) AS cnt FROM user_recommendation_status
    WHERE recommendation_id = ? GROUP BY status
  `),
  doneUsers: appDb.prepare(`
    SELECT u.id AS user_id, u.mobile, urs.updated_at
    FROM user_recommendation_status urs
    JOIN users u ON u.id = urs.user_id
    WHERE urs.recommendation_id = ? AND urs.status = 'done'
    ORDER BY urs.updated_at DESC
    LIMIT 100
  `),
  insertExpertMsg: appDb.prepare(`
    INSERT INTO messages (user_id, title, body, type, related_id, expires_at)
    VALUES (?, ?, ?, 'system', ?, ?)
  `),
  statsToday: appDb.prepare(`
    SELECT COUNT(*) AS cnt FROM messages
    WHERE type IN ('admin_broadcast', 'admin_direct')
      AND date(created_at) = date('now')
  `),
  statsMonth: appDb.prepare(`
    SELECT COUNT(*) AS cnt FROM messages
    WHERE type IN ('admin_broadcast', 'admin_direct')
      AND datetime(created_at) >= datetime('now', 'start of month')
  `),
  statsBroadcastGroups: appDb.prepare(`
    SELECT COUNT(*) AS cnt FROM (
      SELECT 1 FROM messages WHERE type = 'admin_broadcast'
      GROUP BY title, body, expires_at, datetime(created_at)
    )
  `),
  statsDirectCount: appDb.prepare(`
    SELECT COUNT(*) AS cnt FROM messages WHERE type = 'admin_direct'
  `),
  statsReadRate: appDb.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'admin_broadcast' THEN 1 ELSE 0 END), 0) AS broadcast_total,
      COALESCE(SUM(CASE WHEN type = 'admin_broadcast' AND is_read = 1 THEN 1 ELSE 0 END), 0) AS broadcast_read,
      COALESCE(SUM(CASE WHEN type = 'admin_direct' THEN 1 ELSE 0 END), 0) AS direct_total,
      COALESCE(SUM(CASE WHEN type = 'admin_direct' AND is_read = 1 THEN 1 ELSE 0 END), 0) AS direct_read
    FROM messages
    WHERE type IN ('admin_broadcast', 'admin_direct')
  `),
};

const activityLog = adminDb.prepare(`
  SELECT aal.action, aal.detail, aal.created_at, a.username
  FROM admin_activity_log aal
  JOIN admins a ON a.id = aal.admin_id
  WHERE aal.action IN (
    'send_message_broadcast', 'send_message_direct',
    'send_recommendation_broadcast', 'send_recommendation_direct'
  )
  ORDER BY aal.created_at DESC
  LIMIT 500
`);

function persianNum(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

function isFutureIso(iso) {
  if (typeof iso !== 'string' || !iso.length) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
}

function toSqliteTs(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function hasActiveSubscription(user) {
  if (!user?.subscription_plan || !user?.subscription_expires_at) return false;
  const t = new Date(String(user.subscription_expires_at).replace(' ', 'T')).getTime();
  return !Number.isNaN(t) && t > Date.now();
}

function findSentBy(title, target, createdAt, logs) {
  const t = new Date(String(createdAt).replace(' ', 'T')).getTime();
  const wantAction = target === 'all' ? 'send_message_broadcast' : 'send_message_direct';
  for (const row of logs) {
    if (row.action !== wantAction) continue;
    let detail = {};
    try { detail = JSON.parse(row.detail || '{}'); } catch (_) { /* ignore */ }
    if (detail.title !== title) continue;
    const at = new Date(String(row.created_at).replace(' ', 'T')).getTime();
    if (Math.abs(at - t) < 120000) return row.username;
  }
  return null;
}

function pushPayload(title, body, tag, messageId) {
  const text = body.length > 140 ? `${body.slice(0, 137)}…` : body;
  return {
    title,
    body: text,
    tag,
    url: '/messages.html',
    message_id: messageId ?? null,
  };
}

function notifyExpertUser(userId, rec, recId) {
  const pushTitle = rec.priority === 'urgent' ? '🚨 پیشنهاد فوری' : '💡 پیشنهاد تخصصی جدید';
  const msgTitle = rec.priority === 'urgent' ? '🚨 پیشنهاد تخصصی فوری' : '💡 پیشنهاد تخصصی جدید';
  const msgBody = `${rec.title} — برای مشاهده جزئیات به بخش پیشنهاد تخصصی مراجعه کنید.`;
  const msgExpires = rec.expires_at || toSqliteTs(new Date(Date.now() + 7 * 86400000));

  try {
    stmts.insertExpertMsg.run(userId, msgTitle, msgBody, recId, msgExpires);
  } catch (err) {
    console.error('[adminMessaging.expertMsg]', userId, err.message);
  }

  setImmediate(() => {
    push.sendPushAsync(userId, {
      title: pushTitle,
      body: rec.title,
      tag: `expert-rec-${recId}`,
      requireInteraction: rec.priority === 'urgent',
      url: '/expert.html',
      message_id: null,
    });
  });
}

function parseUserIds(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = raw.map((v) => Number(v)).filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

function usersByIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return appDb.prepare(`
    SELECT id, mobile, first_name, last_name
    FROM users WHERE id IN (${placeholders})
  `).all(...ids);
}

function sendMessage(req, res) {
  try {
    const body = req.body || {};
    const target = body.target;
    const title = String(body.title || '').trim();
    const text = String(body.body || '').trim();
    const expiresAt = String(body.expires_at || '').trim();
    const sendPush = body.send_push !== false && body.send_push !== 0 && body.send_push !== '0';

    if (target !== 'all' && target !== 'user' && target !== 'mobile_list') {
      return res.status(400).json({ message: 'مقدار target نامعتبر است' });
    }
    if (!title) {
      return res.status(422).json({ message: 'عنوان پیام الزامی است' });
    }
    if (title.length > 80) {
      return res.status(422).json({ message: 'عنوان نمی‌تواند بیش از ۸۰ کاراکتر باشد' });
    }
    if (!text || text.length > 1000) {
      return res.status(422).json({ message: 'متن پیام نمی‌تواند بیش از ۱۰۰۰ کاراکتر باشد' });
    }
    if (!expiresAt || !isFutureIso(expiresAt)) {
      return res.status(400).json({ message: 'تاریخ انقضا باید در آینده باشد' });
    }

    const expiresTs = toSqliteTs(expiresAt);
    const ip = getClientIp(req);

    if (target === 'user') {
      const uid = Number(body.user_id);
      if (!Number.isInteger(uid) || uid <= 0) {
        return res.status(400).json({ message: 'user_id الزامی است' });
      }
      const u = stmts.userById.get(uid);
      if (!u) return res.status(404).json({ message: 'کاربر مورد نظر یافت نشد' });

      const msgId = insertMessage({
        userId: uid,
        title,
        body: text,
        type: 'admin_direct',
        expiresAt: expiresTs,
      });

      if (sendPush) {
        setImmediate(() => {
          push.sendPushToUser(uid, pushPayload(title, text, `admin-direct-${msgId}`, msgId))
            .catch((err) => console.error('[adminMessaging.pushDirect]', err.message));
        });
      }

      logActivity(req.session.adminId, 'send_message_direct', {
        target_type: 'message',
        target_id: msgId,
        ip,
        detail: { title, target: 'user', sent_count: 1, user_id: uid },
      });

      return res.json({
        success: true,
        sent_count: 1,
        push_queued: sendPush,
        message: `پیام برای کاربر ${u.first_name || ''} ${u.last_name || ''}`.trim() || 'پیام ارسال شد',
      });
    }

    if (target === 'mobile_list') {
      const userIds = parseUserIds(body.user_ids);
      if (!userIds.length) {
        return res.status(400).json({ message: 'لیست کاربران خالی است — ابتدا فایل را بارگذاری کنید' });
      }
      const users = usersByIds(userIds);
      if (!users.length) {
        return res.status(404).json({ message: 'هیچ کاربر معتبری در لیست یافت نشد' });
      }

      let broadcastTagSeed = null;
      let errors = 0;
      const tx = appDb.transaction((rows) => {
        for (const u of rows) {
          try {
            const info = stmts.insertBroadcast.run(u.id, title, text, expiresTs);
            if (broadcastTagSeed == null) broadcastTagSeed = Number(info.lastInsertRowid);
          } catch (_) {
            errors++;
          }
        }
      });
      tx(users);

      const sentCount = users.length - errors;

      if (sendPush) {
        setImmediate(() => {
          const payload = pushPayload(title, text, `admin-bulk-${broadcastTagSeed || Date.now()}`, null);
          for (const u of users) {
            push.sendPushToUser(u.id, payload)
              .catch((err) => console.error('[adminMessaging.pushBulk]', u.id, err.message));
          }
        });
      }

      logActivity(req.session.adminId, 'send_message_broadcast', {
        ip,
        detail: { title, target: 'mobile_list', sent_count: sentCount, user_count: userIds.length },
      });

      const resp = {
        success: true,
        sent_count: sentCount,
        push_queued: sendPush,
        message: `پیام برای ${persianNum(sentCount)} کاربر از فایل ارسال شد`,
      };
      if (errors > 0) resp.errors = errors;
      return res.json(resp);
    }

    const users = stmts.allUsers.all();
    if (!users.length) {
      return res.json({
        success: true,
        sent_count: 0,
        push_queued: false,
        message: 'هیچ کاربری برای ارسال وجود ندارد',
      });
    }

    let broadcastTagSeed = null;
    let errors = 0;
    const tx = appDb.transaction((rows) => {
      for (const u of rows) {
        try {
          const info = stmts.insertBroadcast.run(u.id, title, text, expiresTs);
          if (broadcastTagSeed == null) broadcastTagSeed = Number(info.lastInsertRowid);
        } catch (_) {
          errors++;
        }
      }
    });
    tx(users);

    const sentCount = users.length - errors;

    if (sendPush) {
      setImmediate(() => {
        push.sendPushToAll(pushPayload(title, text, `admin-broadcast-${broadcastTagSeed || Date.now()}`, null))
          .catch((err) => console.error('[adminMessaging.pushBroadcast]', err.message));
      });
    }

    logActivity(req.session.adminId, 'send_message_broadcast', {
      ip,
      detail: { title, target: 'all', sent_count: sentCount },
    });

    const resp = {
      success: true,
      sent_count: sentCount,
      push_queued: sendPush,
      message: `پیام با موفقیت برای ${persianNum(sentCount)} کاربر ارسال شد`,
    };
    if (errors > 0) resp.errors = errors;
    return res.json(resp);
  } catch (err) {
    console.error('[adminMessaging.sendMessage]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function getHistory(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const target = req.query.target;
    const period = req.query.period || 'all';

    const logs = activityLog.all();

    const broadcasts = stmts.adminListBroadcasts.all().map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      type: r.type,
      target: 'all',
      user_id: null,
      user_mobile: null,
      sent_count: Number(r.sent_count || 0),
      read_count: Number(r.read_count || 0),
      read_rate: r.sent_count
        ? Math.round((Number(r.read_count || 0) / Number(r.sent_count)) * 1000) / 10
        : 0,
      expires_at: r.expires_at,
      created_at: r.created_at,
      sent_by: findSentBy(r.title, 'all', r.created_at, logs),
    }));

    const directs = stmts.adminListDirects.all().map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      type: r.type,
      target: 'user',
      user_id: r.user_id,
      user_mobile: r.user_mobile,
      sent_count: 1,
      read_count: Number(r.read_count || 0),
      read_rate: Number(r.read_count || 0) ? 100 : 0,
      expires_at: r.expires_at,
      created_at: r.created_at,
      sent_by: findSentBy(r.title, 'user', r.created_at, logs),
    }));

    let all = broadcasts.concat(directs);

    if (target === 'broadcast') {
      all = all.filter((m) => m.target === 'all');
    } else if (target === 'user' || target === 'direct') {
      all = all.filter((m) => m.target === 'user');
    }

    if (period === 'today') {
      all = all.filter((m) => {
        const d = String(m.created_at).slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        return d === today;
      });
    } else if (period === 'week') {
      const cutoff = Date.now() - 7 * 86400000;
      all = all.filter((m) => new Date(String(m.created_at).replace(' ', 'T')).getTime() >= cutoff);
    } else if (period === 'month') {
      const cutoff = Date.now() - 30 * 86400000;
      all = all.filter((m) => new Date(String(m.created_at).replace(' ', 'T')).getTime() >= cutoff);
    }

    all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const total = all.length;
    const start = (page - 1) * limit;
    const messages = all.slice(start, start + limit);

    return res.json({ messages, total, page, limit });
  } catch (err) {
    console.error('[adminMessaging.getHistory]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function getStats(_req, res) {
  try {
    const today = stmts.statsToday.get();
    const month = stmts.statsMonth.get();
    const broadcastGroups = stmts.statsBroadcastGroups.get();
    const directCount = stmts.statsDirectCount.get();
    const readAgg = stmts.statsReadRate.get();

    const totalMsgs = Number(readAgg.broadcast_total) + Number(readAgg.direct_total);
    const totalRead = Number(readAgg.broadcast_read) + Number(readAgg.direct_read);
    const avgReadRate = totalMsgs > 0
      ? Math.round((totalRead / totalMsgs) * 1000) / 10
      : 0;

    return res.json({
      total_sent_today: Number(today.cnt) || 0,
      total_sent_this_month: Number(month.cnt) || 0,
      avg_read_rate: avgReadRate,
      broadcast_count: Number(broadcastGroups.cnt) || 0,
      direct_count: Number(directCount.cnt) || 0,
    });
  } catch (err) {
    console.error('[adminMessaging.getStats]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function sendExpert(req, res) {
  try {
    const body = req.body || {};
    const target = body.target;
    const recId = Number(body.recommendation_id);
    const ip = getClientIp(req);

    if (target !== 'all_subscribed' && target !== 'user' && target !== 'mobile_list') {
      return res.status(400).json({ message: 'مقدار target نامعتبر است' });
    }
    if (!Number.isInteger(recId) || recId <= 0) {
      return res.status(400).json({ message: 'recommendation_id الزامی است' });
    }

    const rec = stmts.recById.get(recId);
    if (!rec) return res.status(404).json({ message: 'پیشنهاد یافت نشد' });
    if (!rec.is_active) {
      return res.status(400).json({ message: 'این پیشنهاد غیرفعال است' });
    }

    if (target === 'user') {
      const uid = Number(body.user_id);
      if (!Number.isInteger(uid) || uid <= 0) {
        return res.status(400).json({ message: 'user_id الزامی است' });
      }
      const u = stmts.userById.get(uid);
      if (!u) return res.status(404).json({ message: 'کاربر یافت نشد' });
      if (!hasActiveSubscription(u)) {
        return res.status(400).json({ message: 'این کاربر اشتراک فعال ندارد' });
      }

      stmts.insertRecStatus.run(uid, recId);
      notifyExpertUser(uid, rec, recId);

      logActivity(req.session.adminId, 'send_recommendation_direct', {
        target_type: 'recommendation',
        target_id: recId,
        ip,
        detail: { recommendation_id: recId, user_id: uid, sent_count: 1 },
      });

      return res.json({
        success: true,
        sent_count: 1,
        recommendation_title: rec.title,
        message: `پیشنهاد برای ۱ کاربر ارسال شد`,
      });
    }

    if (target === 'mobile_list') {
      const userIds = parseUserIds(body.user_ids);
      if (!userIds.length) {
        return res.status(400).json({ message: 'لیست کاربران خالی است — ابتدا فایل را بارگذاری کنید' });
      }
      const users = usersByIds(userIds);
      let sentCount = 0;
      let skippedNoSub = 0;
      let errors = 0;

      for (const u of users) {
        const full = stmts.userById.get(u.id);
        if (!full || !hasActiveSubscription(full)) {
          skippedNoSub++;
          continue;
        }
        try {
          stmts.insertRecStatus.run(u.id, recId);
          notifyExpertUser(u.id, rec, recId);
          sentCount++;
        } catch (err) {
          errors++;
          console.error('[adminMessaging.expertBulk]', u.id, err.message);
        }
      }

      logActivity(req.session.adminId, 'send_recommendation_broadcast', {
        target_type: 'recommendation',
        target_id: recId,
        ip,
        detail: {
          recommendation_id: recId,
          target: 'mobile_list',
          sent_count: sentCount,
          skipped_no_subscription: skippedNoSub,
        },
      });

      const resp = {
        success: true,
        sent_count: sentCount,
        skipped_no_subscription: skippedNoSub,
        recommendation_title: rec.title,
        message: `پیشنهاد برای ${persianNum(sentCount)} کاربر از فایل ارسال شد`,
      };
      if (errors > 0) resp.errors = errors;
      return res.json(resp);
    }

    const users = stmts.subscribedUsers.all();
    let errors = 0;

    for (const u of users) {
      try {
        stmts.insertRecStatus.run(u.id, recId);
        notifyExpertUser(u.id, rec, recId);
      } catch (err) {
        errors++;
        console.error('[adminMessaging.expertBroadcast]', u.id, err.message);
      }
    }

    const count = users.length;
    logActivity(req.session.adminId, 'send_recommendation_broadcast', {
      target_type: 'recommendation',
      target_id: recId,
      ip,
      detail: { recommendation_id: recId, sent_count: count },
    });

    const resp = {
      success: true,
      sent_count: count,
      recommendation_title: rec.title,
      message: `پیشنهاد برای ${persianNum(count)} کاربر ارسال شد`,
    };
    return res.json(resp);
  } catch (err) {
    console.error('[adminMessaging.sendExpert]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function getExpertStats(req, res) {
  try {
    const recId = Number(req.params.recommendationId);
    if (!Number.isInteger(recId) || recId <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }

    const rec = stmts.recById.get(recId);
    if (!rec) return res.status(404).json({ message: 'پیشنهاد یافت نشد' });

    const rows = stmts.statusStats.all(recId);
    const stats = { pending: 0, done: 0, dismissed: 0, total_sent: 0 };
    for (const r of rows) {
      stats[r.status] = r.cnt;
      stats.total_sent += r.cnt;
    }

    const total = stats.total_sent || 1;
    stats.pending_percent = Math.round((stats.pending / total) * 1000) / 10;
    stats.done_percent = Math.round((stats.done / total) * 1000) / 10;
    stats.dismissed_percent = Math.round((stats.dismissed / total) * 1000) / 10;

    const users_done = stmts.doneUsers.all(recId);

    return res.json({
      recommendation: {
        id: rec.id,
        title: rec.title,
        type: rec.type,
        priority: rec.priority,
        created_at: rec.created_at,
      },
      stats,
      users_done,
    });
  } catch (err) {
    console.error('[adminMessaging.getExpertStats]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function parseMobiles(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'فایل ارسال نشده است' });
    }
    const result = parseMobileImport(req.file.buffer, req.file.originalname);
    return res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('[adminMessaging.parseMobiles]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  sendMessage,
  getHistory,
  getStats,
  sendExpert,
  getExpertStats,
  parseMobiles,
};
