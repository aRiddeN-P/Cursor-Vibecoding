/**
 * pushHelper.js — Phase 3-F
 *
 * Single source of truth for sending Web Push notifications. All call sites
 * should prefer `sendPushAsync(userId, payload)` which is fire-and-forget
 * (returns immediately, never throws, never blocks the HTTP handler).
 *
 * Expired subscriptions (410 Gone / 404 Not Found from the push service)
 * are deleted from the DB on the spot so we stop wasting cycles on them.
 *
 * VAPID details are read from process.env at module load. If keys are
 * missing we still export the same surface but every send is a no-op so
 * the rest of the app keeps working in dev / CI / before VAPID is set up.
 */
'use strict';

const webpush = require('web-push');
const db = require('../db/appDb');

const PUB     = process.env.VAPID_PUBLIC_KEY || '';
const PRIV    = process.env.VAPID_PRIVATE_KEY || '';
const MAILTO  = process.env.VAPID_MAILTO || 'mailto:support@dakhlyar.ir';

const VAPID_CONFIGURED = !!(PUB && PRIV);

if (VAPID_CONFIGURED) {
  try {
    webpush.setVapidDetails(MAILTO, PUB, PRIV);
  } catch (err) {
    console.error('[pushHelper] setVapidDetails failed (keys malformed?):', err.message);
  }
} else {
  console.warn('[pushHelper] VAPID keys missing — Web Push is DISABLED. ' +
    'Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env to enable.');
}

// ─────────────────────── Prepared statements ────────────────────────────────
const stmts = {
  byUser: db.prepare(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
  ),
  allUsers: db.prepare(
    'SELECT DISTINCT user_id FROM push_subscriptions'
  ),
  touchUsed: db.prepare(
    "UPDATE push_subscriptions SET last_used = datetime('now') WHERE id = ?"
  ),
  delete: db.prepare('DELETE FROM push_subscriptions WHERE id = ?'),
};

function isExpiredErr(err) {
  if (!err) return false;
  const code = err.statusCode || (err.body && err.body.statusCode);
  return code === 404 || code === 410;
}

/**
 * sendPushToUser — ACTUALLY waits for delivery to complete.
 * Most call sites should use `sendPushAsync` instead.
 *
 * @returns {Promise<Array<{id:number,status:string,error?:string}>>}
 */
async function sendPushToUser(userId, payload) {
  if (!VAPID_CONFIGURED || !userId) return [];
  let subs;
  try {
    subs = stmts.byUser.all(userId);
  } catch (err) {
    console.error('[pushHelper] DB read failed:', err.message);
    return [];
  }
  if (!subs.length) return [];

  const body = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  const results = [];

  // Parallel — push service tolerates concurrent sends to different endpoints.
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      );
      try { stmts.touchUsed.run(sub.id); } catch (_) {}
      results.push({ id: sub.id, status: 'sent' });
    } catch (err) {
      if (isExpiredErr(err)) {
        try { stmts.delete.run(sub.id); } catch (_) {}
        results.push({ id: sub.id, status: 'removed' });
      } else {
        const code = err.statusCode || 'n/a';
        console.error(`[pushHelper] send failed (sub=${sub.id}, status=${code}):`, err.message);
        results.push({ id: sub.id, status: 'failed', error: err.message });
      }
    }
  }));

  return results;
}

/**
 * sendPushToAll — iterate every user that has at least one subscription.
 * Safe for "admin broadcast" — falls back to no-op if VAPID is unset.
 *
 * Returns a summary, not per-row results.
 */
async function sendPushToAll(payload) {
  if (!VAPID_CONFIGURED) return { recipients: 0, total: 0 };
  let userIds = [];
  try {
    userIds = stmts.allUsers.all().map((r) => r.user_id);
  } catch (err) {
    console.error('[pushHelper] DB read failed in sendPushToAll:', err.message);
    return { recipients: 0, total: 0 };
  }
  let total = 0;
  for (const uid of userIds) {
    const r = await sendPushToUser(uid, payload);
    total += r.filter((x) => x.status === 'sent').length;
  }
  return { recipients: userIds.length, total };
}

/**
 * sendPushAsync — fire-and-forget wrapper. Use this from every controller
 * that just wants to "notify the user" without blocking the response.
 *
 * Returns void synchronously. Errors are logged, never thrown.
 */
function sendPushAsync(userId, payload) {
  if (!VAPID_CONFIGURED || !userId) return;
  setImmediate(() => {
    sendPushToUser(userId, payload).catch((err) => {
      console.error('[pushHelper] sendPushAsync failed:', err && err.message);
    });
  });
}

/**
 * sendPushAsyncToAll — fire-and-forget broadcast variant.
 */
function sendPushAsyncToAll(payload) {
  if (!VAPID_CONFIGURED) return;
  setImmediate(() => {
    sendPushToAll(payload).catch((err) => {
      console.error('[pushHelper] sendPushAsyncToAll failed:', err && err.message);
    });
  });
}

module.exports = {
  sendPushToUser,
  sendPushToAll,
  sendPushAsync,
  sendPushAsyncToAll,
  isVapidConfigured: () => VAPID_CONFIGURED,
  vapidPublicKey: () => PUB,
};
