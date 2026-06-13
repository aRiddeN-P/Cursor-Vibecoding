/**
 * recurringHelper.js — Phase 5
 *
 * Two responsibilities:
 *
 *   1. checkBudgetAlert(userId, categoryId, monthGregorian)
 *      Called after each transaction insert/update. Looks at the user's
 *      budget for this category in this month (table `budgets` will be
 *      added in Phase 6) and emits a "80% reached" / "budget exhausted"
 *      message at most ONCE per (category, month) per day.
 *
 *      Safe no-op when the `budgets` table doesn't exist yet.
 *
 *   2. checkRecurringTransactions()
 *      Called by the periodic scheduler in server/index.js. For each row
 *      in `recurring_alerts` whose `next_expected` is today/past AND
 *      wasn't already sent today, emits a "reminder" message and bumps
 *      `next_expected` by the matching interval.
 *
 * Both functions are fire-and-forget safe — they never throw and never
 * block the caller. All push calls (when applicable) go through the
 * Phase 3-F helper so we don't double-up logic.
 */
'use strict';

const db = require('../db/appDb');
const messages = require('../controllers/messagesController');
const push = require('./pushHelper');

// ─────────────────────────── Date helpers ──────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * calculateNextDate — returns the YYYY-MM-DD string `interval` after the
 * supplied Gregorian date. Handles end-of-month rollover for monthly
 * (e.g. Jan 31 + 1mo → Feb 28/29).
 */
function calculateNextDate(dateStr, interval) {
  if (!ISO_DATE.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  let nextY = y, nextM = m, nextD = d;
  if (interval === 'weekly') {
    const t = new Date(Date.UTC(y, m - 1, d));
    t.setUTCDate(t.getUTCDate() + 7);
    return t.toISOString().slice(0, 10);
  }
  if (interval === 'yearly') {
    nextY += 1;
  } else {
    // default to monthly
    nextM += 1;
    if (nextM > 12) { nextM = 1; nextY += 1; }
  }
  // Clamp the day to the new month's last day.
  const lastDay = new Date(Date.UTC(nextY, nextM, 0)).getUTCDate();
  if (nextD > lastDay) nextD = lastDay;
  const mm = String(nextM).padStart(2, '0');
  const dd = String(nextD).padStart(2, '0');
  return `${nextY}-${mm}-${dd}`;
}

function endOfMonthIso(monthYYYYMM) {
  // monthYYYYMM = "2026-06"
  const [y, m] = monthYYYYMM.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthYYYYMM}-${String(last).padStart(2, '0')} 23:59:59`;
}

function currentMonth() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ─────────────────────────── Cached helpers ────────────────────────────────

let _budgetsTableChecked = false;
let _budgetsTableExists = false;
function budgetsTableExists() {
  if (_budgetsTableChecked) return _budgetsTableExists;
  _budgetsTableChecked = true;
  try {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'budgets' LIMIT 1"
    ).get();
    _budgetsTableExists = !!row;
  } catch (_) {
    _budgetsTableExists = false;
  }
  return _budgetsTableExists;
}

// ─────────────────────────── Prepared statements ───────────────────────────

const stmts = {
  spentInMonth: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS spent
      FROM transactions
     WHERE user_id = ?
       AND category_id = ?
       AND type = 'expense'
       AND is_deleted = 0
       AND transaction_date LIKE ?
  `),
  categoryName: db.prepare(
    'SELECT name FROM categories WHERE id = ? LIMIT 1'
  ),
  dueRecurring: db.prepare(`
    SELECT ra.id           AS alert_id,
           ra.user_id      AS user_id,
           ra.transaction_id,
           ra.next_expected,
           ra.alert_sent_at,
           t.title         AS title,
           t.amount        AS amount,
           t.recurring_interval,
           t.type          AS tx_type,
           c.name          AS category_name,
           c.icon          AS category_icon
      FROM recurring_alerts ra
      JOIN transactions t ON t.id = ra.transaction_id
      LEFT JOIN categories c ON c.id = t.category_id
     WHERE date(ra.next_expected) <= date('now')
       AND (ra.alert_sent_at IS NULL OR date(ra.alert_sent_at) < date('now'))
       AND t.is_deleted = 0
  `),
  markAlertSent: db.prepare(`
    UPDATE recurring_alerts
       SET alert_sent_at = datetime('now'),
           next_expected = ?
     WHERE id = ?
  `),
};

function faDigit(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}
function withSeparators(n) {
  return faDigit(Number(n).toLocaleString('en'));
}

// ─────────────────────────── Public — budget alert ─────────────────────────

function checkBudgetAlert(userId, categoryId, monthYYYYMM) {
  try {
    if (!userId || !categoryId) return;
    const month = monthYYYYMM || currentMonth();

    // Look up the user's budget for this (category, month). Schema unknown
    // at this point — try the most likely shape and bail silently otherwise.
    let budget = 0;
    try {
      const row = db.prepare(`
        SELECT amount FROM budgets
         WHERE user_id = ? AND category_id = ? AND month = ?
         LIMIT 1
      `).get(userId, categoryId, month);
      budget = row ? Number(row.amount || 0) : 0;
    } catch (_) { return; }

    if (!budget || budget < 0) return;

    const spent = Number(
      stmts.spentInMonth.get(userId, categoryId, `${month}-%`).spent || 0
    );
    if (spent <= 0) return;

    const catName = (stmts.categoryName.get(categoryId) || {}).name || 'دسته‌بندی';
    const monthFa = faDigit(month);

    // Two thresholds: 80%+ and 100%+.
    const pct = Math.min(999, Math.floor((spent / budget) * 100));
    let title = null;
    let body  = null;
    if (spent >= budget) {
      title = `بودجه ${catName} تمام شد`;
      body  = `بودجه تعیین‌شده برای ${catName} در ${monthFa} به پایان رسیده است.`;
    } else if (spent >= budget * 0.8) {
      title = `هشدار بودجه — ${catName}`;
      body  = `شما ${faDigit(pct)}٪ از بودجه ${catName} در ${monthFa} را مصرف کرده‌اید.`;
    } else {
      return;
    }

    // Dedup using insertDedupedMessage (no second message of the same body
    // pattern in the last 2 days). Body unique enough since it includes the
    // month and the category name.
    const id = messages.insertDedupedMessage({
      userId,
      type: 'admin_direct', // reuse existing accepted enum for "system" msgs
      bodyLikePattern: `%${catName}%${monthFa}%`,
      title,
      body,
      relatedId: categoryId,
      expiresAt: endOfMonthIso(month),
    });
    if (id) push.sendPushAsync(userId, { title, body, tag: `budget-${categoryId}-${month}`, url: '/messages.html', message_id: id });
  } catch (err) {
    console.error('[recurringHelper.checkBudgetAlert]', err && err.message);
  }
}

// ─────────────────────────── Public — recurring check ──────────────────────

function checkRecurringTransactions() {
  try {
    const rows = stmts.dueRecurring.all();
    if (!rows.length) return 0;
    let sent = 0;
    for (const r of rows) {
      try {
        const title = 'یادآور تراکنش تکراری';
        const body = `تراکنش تکراری «${r.title}» به مبلغ ${withSeparators(r.amount)} تومان سررسید شده است.`;
        const msgId = messages.insertMessage({
          userId: r.user_id,
          title,
          body,
          type: 'admin_direct',
          relatedId: r.transaction_id,
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        });
        push.sendPushAsync(r.user_id, {
          title, body,
          tag: 'recurring-' + r.transaction_id,
          url: '/transactions.html',
          message_id: msgId,
        });
        const nextDate = calculateNextDate(r.next_expected, r.recurring_interval || 'monthly');
        stmts.markAlertSent.run(nextDate, r.alert_id);
        sent += 1;
      } catch (rowErr) {
        console.error('[recurringHelper.checkRecurringTransactions row]', rowErr && rowErr.message);
      }
    }
    return sent;
  } catch (err) {
    console.error('[recurringHelper.checkRecurringTransactions]', err && err.message);
    return 0;
  }
}

module.exports = {
  calculateNextDate,
  checkBudgetAlert,
  checkRecurringTransactions,
  // exposed for tests
  _internals: { currentMonth, endOfMonthIso },
};
