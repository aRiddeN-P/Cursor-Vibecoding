#!/usr/bin/env node
/**
 * scripts/send-test-push.js
 *
 * Dev tool — send a test Web Push to a specific user_id (or to everyone).
 *
 * Usage:
 *   node scripts/send-test-push.js <user_id> "<title>" "<body>"
 *   node scripts/send-test-push.js all       "<title>" "<body>"
 *   node scripts/send-test-push.js list                      # show all subscriptions
 *
 * Examples:
 *   node scripts/send-test-push.js 1 "سلام" "این یک تست است"
 *   node scripts/send-test-push.js all "اطلاعیه" "تست همگانی"
 *   node scripts/send-test-push.js list
 *
 * Reads VAPID keys + APP_DB_PATH from .env (same as the main server).
 */
'use strict';

require('dotenv').config();
const db = require('../server/db/appDb');
const push = require('../server/utils/pushHelper');

async function main() {
  const [target, title, body] = process.argv.slice(2);

  if (!target) {
    console.error('Usage:\n  node scripts/send-test-push.js <user_id|all|list> [title] [body]');
    process.exit(1);
  }

  if (target === 'list') {
    const rows = db.prepare(`
      SELECT id, user_id, substr(endpoint, 1, 60) || '…' AS endpoint,
             substr(user_agent, 1, 50) AS user_agent,
             created_at, last_used
      FROM push_subscriptions
      ORDER BY user_id, id
    `).all();
    if (!rows.length) {
      console.log('هیچ subscription ای در DB وجود ندارد. ابتدا در مرورگر روی دکمه‌ی «فعال‌سازی» در بنر پوش کلیک کنید.');
      return;
    }
    console.table(rows);
    return;
  }

  if (!push.isVapidConfigured()) {
    console.error('VAPID keys در .env تنظیم نشده‌اند. ابتدا VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY را ست کنید.');
    process.exit(1);
  }

  const payload = {
    title: title || 'تست پوش دخلیار',
    body:  body  || 'این یک پیام تست از خط فرمان است',
    tag:   'manual-test-' + Date.now(),
    url:   '/messages.html',
  };

  if (target === 'all') {
    const r = await push.sendPushToAll(payload);
    console.log('✓ broadcast →', r);
    return;
  }

  const uid = Number.parseInt(target, 10);
  if (!Number.isInteger(uid) || uid < 1) {
    console.error(`user_id نامعتبر: ${target}`);
    process.exit(1);
  }

  const r = await push.sendPushToUser(uid, payload);
  if (!r.length) {
    console.log(`کاربر ${uid} هیچ subscription فعالی ندارد.`);
    return;
  }
  console.log('نتیجه برای هر subscription:');
  console.table(r);
}

main().catch((err) => {
  console.error('✗', err);
  process.exit(1);
});
