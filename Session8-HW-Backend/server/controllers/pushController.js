/**
 * pushController.js — Phase 3-F
 * Endpoints for VAPID public key delivery + subscription lifecycle.
 */
'use strict';

const db = require('../db/appDb');
const pushHelper = require('../utils/pushHelper');

// Prepared statements
const insertOrReplace = db.prepare(`
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, created_at, last_used)
  VALUES (@user_id, @endpoint, @p256dh, @auth, @user_agent, datetime('now'), datetime('now'))
  ON CONFLICT(endpoint) DO UPDATE SET
    user_id    = excluded.user_id,
    p256dh     = excluded.p256dh,
    auth       = excluded.auth,
    user_agent = excluded.user_agent,
    last_used  = datetime('now')
`);

const deleteByEndpoint = db.prepare(
  'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?'
);

// ── handlers ────────────────────────────────────────────────────────────────

function getVapidPublicKey(_req, res) {
  const publicKey = pushHelper.vapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({
      message: 'سرویس پوش نوتیفیکیشن در حال حاضر در دسترس نیست',
      publicKey: null,
    });
  }
  return res.json({ publicKey });
}

function subscribe(req, res) {
  const userId = req.session && req.session.user_id;
  if (!userId) {
    return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
  }

  const { endpoint, keys, userAgent } = req.body || {};
  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ message: 'endpoint نامعتبر است' });
  }
  if (!keys || typeof keys !== 'object' || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ message: 'کلیدهای رمزنگاری ناقص هستند' });
  }

  try {
    insertOrReplace.run({
      user_id: userId,
      endpoint: endpoint,
      p256dh: String(keys.p256dh),
      auth: String(keys.auth),
      user_agent: userAgent ? String(userAgent).slice(0, 300) : null,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[push.subscribe] DB error:', err.message);
    return res.status(500).json({ message: 'ذخیره‌ی اشتراک پوش با خطا مواجه شد' });
  }
}

function unsubscribe(req, res) {
  const userId = req.session && req.session.user_id;
  if (!userId) {
    return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
  }
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ message: 'endpoint الزامی است' });
  }
  try {
    deleteByEndpoint.run(String(endpoint), userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[push.unsubscribe] DB error:', err.message);
    return res.status(500).json({ message: 'حذف اشتراک پوش با خطا مواجه شد' });
  }
}

module.exports = {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
};
