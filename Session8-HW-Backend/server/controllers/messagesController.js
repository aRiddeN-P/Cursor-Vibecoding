/**
 * messagesController.js — Phase 3-D
 *
 * Inbox / messages system. Replaces the old `notifications` table from
 * Phase 3. Highlights:
 *
 *   • Visibility window: read messages disappear after 7 days; everything
 *     older than 2 months is hidden once read.
 *   • Auto-expire: messages with `expires_at` in the past are flipped to
 *     is_read=1 (so the 7-day window kicks in from expiry time, NOT from
 *     when the user opened the inbox).
 *   • Upsert: result messages (verification_result, subscription_result)
 *     overwrite their original request message in-place — we never show
 *     two rows for the same topic.
 *   • Dedup: expiry warnings ("10/5/1 day left" or "3/1 day left for
 *     referral discount") check for a recent duplicate before INSERT.
 *
 * Exports the controller endpoints + a set of reusable helpers used by
 * other controllers (verification, subscription, referral, auth).
 */
'use strict';

const db = require('../db/appDb');
const { persianTimeAgo } = require('../utils/timeHelper');
// Lazy-loaded to keep startup order flexible — pushHelper requires the DB
// to be ready, which it is, but loading it lazily lets the messages module
// stay importable even if VAPID is misconfigured at boot.
function _push() {
  try { return require('../utils/pushHelper'); }
  catch (_) { return { sendPushAsync: () => {}, sendPushAsyncToAll: () => {} }; }
}

// ─────────────────────────── Constants ──────────────────────────────────────

const MESSAGE_TYPES = Object.freeze([
  'verification_request',
  'verification_result',
  'subscription_request',
  'subscription_result',
  'subscription_expiry_warning',
  'subscription_expired',
  'admin_broadcast',
  'admin_direct',
  'referral',
]);

// Result/request type pairing used by the upsert helper.
const REQUEST_TO_RESULT = Object.freeze({
  verification_request: 'verification_result',
  subscription_request: 'subscription_result',
});

// ─────────────────────────── Prepared statements ────────────────────────────

const stmts = {
  insert: db.prepare(`
    INSERT INTO messages (user_id, title, body, type, related_id, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  // Visibility rules (mirrors the spec):
  //   • read messages: hide after 7d-from-read
  //   • any message: hide after 2 months if read
  // Auto-expire is run separately before SELECT so expired rows show up
  // here already marked as read with `read_at = NOW`, meaning they live for
  // exactly 7 more days then disappear.
  listForUser: db.prepare(`
    SELECT id, title, body, type, related_id, is_read, read_at, expires_at, created_at
      FROM messages
     WHERE user_id = ?
       AND NOT (is_read = 1 AND read_at IS NOT NULL
                AND datetime(read_at) < datetime('now', '-7 days'))
       AND NOT (datetime(created_at) < datetime('now', '-2 months') AND is_read = 1)
     ORDER BY datetime(created_at) DESC
     LIMIT 200
  `),

  unreadCount: db.prepare(`
    SELECT COUNT(*) AS cnt
      FROM messages
     WHERE user_id = ? AND is_read = 0
       AND NOT (is_read = 1 AND read_at IS NOT NULL
                AND datetime(read_at) < datetime('now', '-7 days'))
       AND NOT (datetime(created_at) < datetime('now', '-2 months') AND is_read = 1)
  `),

  findOwn: db.prepare('SELECT * FROM messages WHERE id = ?'),

  markOneRead: db.prepare(`
    UPDATE messages
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ? AND is_read = 0
  `),

  markAllRead: db.prepare(`
    UPDATE messages
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND is_read = 0
  `),

  deleteOwn: db.prepare(
    'DELETE FROM messages WHERE id = ? AND user_id = ? AND is_read = 1'
  ),

  // For upsert: find the *latest* request message for a given (user, type, related_id)
  findRequestMessage: db.prepare(`
    SELECT id FROM messages
     WHERE user_id = ? AND type = ? AND related_id = ?
     ORDER BY id DESC LIMIT 1
  `),

  updateMessageInPlace: db.prepare(`
    UPDATE messages
       SET type = ?, title = ?, body = ?,
           expires_at = ?,
           is_read = 0, read_at = NULL,
           created_at = CURRENT_TIMESTAMP
     WHERE id = ?
  `),

  // Dedup: any message for this user/type whose body contains a needle and
  // was created in the last 2 days (so we don't spam the same warning).
  findRecentByBodyLike: db.prepare(`
    SELECT id FROM messages
     WHERE user_id = ? AND type = ?
       AND body LIKE ?
       AND datetime(created_at) > datetime('now', '-2 days')
     ORDER BY id DESC LIMIT 1
  `),

  autoExpire: db.prepare(`
    UPDATE messages
       SET is_read = 1, read_at = CURRENT_TIMESTAMP
     WHERE expires_at IS NOT NULL
       AND datetime(expires_at) < datetime('now')
       AND is_read = 0
  `),

  // Admin endpoints
  countAllUsers: db.prepare('SELECT COUNT(*) AS cnt FROM users'),
  selectUserExists: db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?'),
  insertManyUsers: db.prepare('SELECT id FROM users'),

  // For admin listing: group broadcasts by (title, body, type) — best-effort
  adminListBroadcasts: db.prepare(`
    SELECT MIN(id)     AS id,
           title, body, type, expires_at,
           MIN(datetime(created_at)) AS created_at,
           COUNT(*)     AS sent_count,
           SUM(is_read) AS read_count,
           NULL         AS user_id
      FROM messages
     WHERE type = 'admin_broadcast'
     GROUP BY title, body, type, expires_at, datetime(created_at)
     ORDER BY MIN(id) DESC
  `),
  adminListDirects: db.prepare(`
    SELECT m.id, m.title, m.body, m.type, m.expires_at, m.created_at,
           1            AS sent_count,
           m.is_read    AS read_count,
           m.user_id    AS user_id,
           COALESCE(NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''), 'کاربر دخلیار') AS user_name
      FROM messages m
      LEFT JOIN users u ON u.id = m.user_id
     WHERE m.type = 'admin_direct'
     ORDER BY m.id DESC
  `),
};

// ─────────────────────────── Helpers ────────────────────────────────────────

function isFutureIso(iso) {
  if (typeof iso !== 'string' || !iso.length) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

// Normalize a JS Date / ISO / "now+Nd" into the SQLite "YYYY-MM-DD HH:MM:SS" format.
function toSqliteTs(input) {
  if (input == null) return null;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input)) {
    return input;
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * autoExpireMessages — called both by the periodic scheduler in server/index.js
 * AND inline by GET /api/messages so the user sees the freshest state.
 *
 * Returns the number of rows touched.
 */
function autoExpireMessages() {
  try {
    return stmts.autoExpire.run().changes || 0;
  } catch (err) {
    console.error('[messages.autoExpire] error:', err);
    return 0;
  }
}

/**
 * upsertResultMessage — if a request message exists for (userId, requestType,
 * relatedId), update it in-place with the new result content. Otherwise
 * INSERT a brand-new message so the user still receives the result even if
 * the original was already pruned.
 *
 * @param {object} opts
 * @param {number} opts.userId
 * @param {number} opts.relatedId
 * @param {string} opts.requestType   one of 'verification_request' | 'subscription_request'
 * @param {string} opts.resultType    one of 'verification_result' | 'subscription_result'
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {?string} opts.expiresAt    ISO/SQLite datetime — when the message itself disappears
 * @returns {{ id: number, mode: 'updated' | 'inserted' }}
 */
function upsertResultMessage(opts) {
  const { userId, relatedId, requestType, resultType, title, body, expiresAt } = opts || {};
  if (!userId || !relatedId || !resultType || !title || !body) {
    throw new Error('upsertResultMessage: missing required fields');
  }
  if (!REQUEST_TO_RESULT[requestType]) {
    throw new Error(`upsertResultMessage: unknown requestType ${requestType}`);
  }
  if (!MESSAGE_TYPES.includes(resultType)) {
    throw new Error(`upsertResultMessage: unknown resultType ${resultType}`);
  }
  const existing = stmts.findRequestMessage.get(userId, requestType, relatedId);
  const ts = toSqliteTs(expiresAt);
  if (existing) {
    stmts.updateMessageInPlace.run(resultType, title, body, ts, existing.id);
    return { id: existing.id, mode: 'updated' };
  }
  const info = stmts.insert.run(userId, title, body, resultType, relatedId, ts);
  return { id: Number(info.lastInsertRowid), mode: 'inserted' };
}

/**
 * insertMessage — thin wrapper around the prepared INSERT. Centralized so
 * we can validate the `type` field once. Use this from any controller.
 *
 * @param {object} opts
 * @param {number} opts.userId
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} opts.type
 * @param {?number} opts.relatedId
 * @param {?string|Date} opts.expiresAt
 * @returns {number} new message id
 */
function insertMessage(opts) {
  const { userId, title, body, type, relatedId = null, expiresAt = null } = opts || {};
  if (!userId || !title || !body || !type) {
    throw new Error('insertMessage: missing required fields');
  }
  if (!MESSAGE_TYPES.includes(type)) {
    throw new Error(`insertMessage: unknown type ${type}`);
  }
  const info = stmts.insert.run(userId, title, body, type, relatedId, toSqliteTs(expiresAt));
  return Number(info.lastInsertRowid);
}

/**
 * insertDedupedMessage — like insertMessage but first checks for a message
 * of the same type whose body matches `bodyLikePattern` and was created in
 * the last 2 days. If one exists, returns null (no insert performed).
 */
function insertDedupedMessage(opts) {
  const { userId, type, bodyLikePattern } = opts || {};
  if (!userId || !type || !bodyLikePattern) {
    throw new Error('insertDedupedMessage: missing required fields');
  }
  const recent = stmts.findRecentByBodyLike.get(userId, type, bodyLikePattern);
  if (recent) return null;
  return insertMessage(opts);
}

function shapeMessage(row, nowMs) {
  const expiresAtMs = row.expires_at ? new Date(toSqliteTs(row.expires_at).replace(' ', 'T') + 'Z').getTime() : null;
  const isExpired = expiresAtMs != null && !Number.isNaN(expiresAtMs) && expiresAtMs < nowMs;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    related_id: row.related_id,
    is_read: !!row.is_read,
    is_expired: isExpired,
    expires_at: row.expires_at,
    created_at: row.created_at,
    read_at: row.read_at,
    time_ago: persianTimeAgo(row.created_at),
  };
}

// ============================================================
//                       GET /api/messages
// ============================================================

function listEndpoint(req, res) {
  try {
    autoExpireMessages();
    const rows = stmts.listForUser.all(req.session.user_id);
    const unread_count = stmts.unreadCount.get(req.session.user_id).cnt;
    const now = Date.now();
    return res.json({
      messages: rows.map((r) => shapeMessage(r, now)),
      unread_count,
    });
  } catch (err) {
    console.error('[messages.list] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//                  PATCH /api/messages/:id/read
// ============================================================

function markReadEndpoint(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه پیام معتبر نیست' });
    }
    const msg = stmts.findOwn.get(id);
    if (!msg) return res.status(404).json({ message: 'پیام یافت نشد' });
    if (msg.user_id !== req.session.user_id) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }
    if (msg.is_read) return res.json({ success: true, already_read: true });
    stmts.markOneRead.run(id, req.session.user_id);
    return res.json({ success: true });
  } catch (err) {
    console.error('[messages.markRead] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//                 PATCH /api/messages/read-all
// ============================================================

function markAllReadEndpoint(req, res) {
  try {
    const info = stmts.markAllRead.run(req.session.user_id);
    return res.json({ success: true, updated_count: info.changes || 0 });
  } catch (err) {
    console.error('[messages.markAllRead] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//                   DELETE /api/messages/:id
// ============================================================

function deleteEndpoint(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه پیام معتبر نیست' });
    }
    const msg = stmts.findOwn.get(id);
    if (!msg) return res.status(404).json({ message: 'پیام یافت نشد' });
    if (msg.user_id !== req.session.user_id) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }
    if (!msg.is_read) {
      return res.status(400).json({ message: 'پیام‌های خوانده نشده قابل حذف نیستند' });
    }
    stmts.deleteOwn.run(id, req.session.user_id);
    return res.json({ success: true });
  } catch (err) {
    console.error('[messages.delete] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//          ADMIN  POST /api/admin/messages/send
// ============================================================

function adminSendEndpoint(req, res) {
  try {
    const body = req.body || {};
    const target = body.target;
    const title = (body.title || '').toString().trim();
    const text  = (body.body  || '').toString().trim();
    const expiresAt = (body.expires_at || '').toString().trim();

    if (target !== 'all' && target !== 'user') {
      return res.status(400).json({ message: 'مقدار target نامعتبر است — مقادیر مجاز: all یا user' });
    }
    if (!title || title.length > 200) {
      return res.status(400).json({ message: 'عنوان پیام الزامی است و حداکثر ۲۰۰ کاراکتر' });
    }
    if (!text || text.length > 2000) {
      return res.status(400).json({ message: 'متن پیام الزامی است و حداکثر ۲۰۰۰ کاراکتر' });
    }
    if (!expiresAt || !isFutureIso(expiresAt)) {
      return res.status(400).json({ message: 'تاریخ انقضا باید در آینده باشد' });
    }

    const expiresTs = toSqliteTs(expiresAt);

    if (target === 'user') {
      const uid = Number.parseInt(body.user_id, 10);
      if (!Number.isInteger(uid) || uid < 1) {
        return res.status(400).json({ message: 'user_id الزامی است وقتی target برابر user است' });
      }
      const u = stmts.selectUserExists.get(uid);
      if (!u) return res.status(404).json({ message: 'کاربر مورد نظر یافت نشد' });
      const msgId = insertMessage({
        userId: uid, title, body: text, type: 'admin_direct', expiresAt: expiresTs,
      });
      // Phase 3-F — push direct admin message.
      _push().sendPushAsync(uid, {
        title,
        body: text.length > 140 ? text.slice(0, 137) + '…' : text,
        tag: 'admin-direct-' + msgId,
        url: '/messages.html',
        message_id: msgId,
      });
      return res.json({
        success: true,
        sent_count: 1,
        message: `پیام برای کاربر ${u.first_name || ''} ${u.last_name || ''}`.trim() || 'پیام ارسال شد',
      });
    }

    // target === 'all'
    const users = stmts.insertManyUsers.all();
    if (!users.length) {
      return res.json({ success: true, sent_count: 0, message: 'هیچ کاربری برای ارسال وجود ندارد' });
    }
    let broadcastTagSeed = null;
    const tx = db.transaction((rows) => {
      for (const u of rows) {
        const info = stmts.insert.run(u.id, title, text, 'admin_broadcast', null, expiresTs);
        if (broadcastTagSeed == null) broadcastTagSeed = Number(info.lastInsertRowid);
      }
    });
    tx(users);

    // Phase 3-F — push the same payload to every subscribed device.
    _push().sendPushAsyncToAll({
      title,
      body: text.length > 140 ? text.slice(0, 137) + '…' : text,
      tag: 'admin-broadcast-' + (broadcastTagSeed || Date.now()),
      url: '/messages.html',
    });

    const persianCount = String(users.length).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
    return res.json({
      success: true,
      sent_count: users.length,
      message: `پیام با موفقیت برای ${persianCount} کاربر ارسال شد`,
    });
  } catch (err) {
    console.error('[messages.adminSend] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//          ADMIN  GET /api/admin/messages
// ============================================================

function adminListEndpoint(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const target = req.query.target;
    const userId = Number.parseInt(req.query.user_id, 10);

    const broadcasts = stmts.adminListBroadcasts.all().map((r) => ({
      ...r,
      target: 'all',
      user_id: null,
      user_name: null,
    }));
    const directs = stmts.adminListDirects.all().map((r) => ({
      ...r,
      target: 'user',
    }));

    let all = broadcasts.concat(directs);
    if (target === 'all') all = all.filter((m) => m.target === 'all');
    if (target === 'user') all = all.filter((m) => m.target === 'user');
    if (Number.isInteger(userId) && userId >= 1) {
      all = all.filter((m) => m.user_id === userId);
    }
    // newest first by created_at
    all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const total = all.length;
    const start = (page - 1) * limit;
    const pageRows = all.slice(start, start + limit).map((m) => ({
      id: m.id,
      title: m.title,
      body: m.body,
      type: m.type,
      target: m.target,
      user_id: m.user_id,
      user_name: m.user_name || null,
      sent_count: Number(m.sent_count || 0),
      read_count: Number(m.read_count || 0),
      expires_at: m.expires_at,
      created_at: m.created_at,
    }));

    return res.json({ messages: pageRows, total, page, limit });
  } catch (err) {
    console.error('[messages.adminList] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  // endpoints
  listEndpoint,
  markReadEndpoint,
  markAllReadEndpoint,
  deleteEndpoint,
  adminSendEndpoint,
  adminListEndpoint,
  // reusable helpers
  insertMessage,
  insertDedupedMessage,
  upsertResultMessage,
  autoExpireMessages,
  MESSAGE_TYPES,
};
