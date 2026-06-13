/**
 * transactionsController.js — Phase 5
 *
 * Income/expense tracking. amount is ALWAYS stored as a positive integer
 * in Toman; `type` ('income'|'expense') encodes the direction. Soft-delete
 * via `is_deleted = 1` — rows are never physically removed.
 *
 * Endpoints (mounted under /api/transactions):
 *
 *   GET    /                — paginated list + filters + summary
 *   GET    /:id             — one row (ownership-checked)
 *   POST   /                — create one
 *   PATCH  /:id             — partial update
 *   DELETE /:id             — soft delete
 *   POST   /bulk-delete     — bulk soft delete
 *   POST   /import          — CSV import (multipart)
 *   GET    /sample-csv      — sample template download
 *   GET    /tags            — per-user tags (sorted by usage)
 *   GET    /summary         — month summary + top expense categories + recurring
 *   GET    /recurring       — recurring transactions list
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const XLSX = require('xlsx');
const jalaali = require('jalaali-js');

const db = require('../db/appDb');
const { calculateNextDate, checkBudgetAlert } = require('../utils/recurringHelper');

// ────────────────────────────── Constants ──────────────────────────────────

const TYPES = Object.freeze(['income', 'expense']);
const INTERVALS = Object.freeze(['weekly', 'monthly', 'yearly']);
const MAX_AMOUNT = 999_999_999_999;
const TITLE_MAX = 60;
const NOTE_MAX = 500;
const TAG_MAX = 20;
const TAGS_MAX_COUNT = 5;
const PAGE_LIMIT_DEFAULT = 20;
const PAGE_LIMIT_MAX = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const JALALI_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SAMPLE_CSV_PATH = path.resolve(__dirname, '..', '..', 'sample', 'transactions_sample.csv');

// ────────────────────────────── Prepared stmts ─────────────────────────────

const stmts = {
  ownCategory: db.prepare(`
    SELECT id, name, type FROM categories
     WHERE id = ?
       AND is_active = 1
       AND (
         (is_default = 1 AND user_id IS NULL)
         OR
         (is_default = 0 AND user_id = ?)
       )
     LIMIT 1
  `),

  defaultCategoryByName: db.prepare(`
    SELECT id, name, type FROM categories
     WHERE is_active = 1 AND lower(name) = lower(?)
       AND ((is_default = 1 AND user_id IS NULL) OR (is_default = 0 AND user_id = ?))
     LIMIT 1
  `),

  fallbackCategory: db.prepare(`
    SELECT id FROM categories
     WHERE is_default = 1 AND user_id IS NULL AND name = 'متفرقه' LIMIT 1
  `),

  insertTx: db.prepare(`
    INSERT INTO transactions (
      user_id, type, amount, currency,
      amount_original, currency_original, exchange_rate,
      category_id, title, note, tags,
      transaction_date, transaction_time,
      is_recurring, recurring_interval
    ) VALUES (
      @user_id, @type, @amount, @currency,
      @amount_original, @currency_original, @exchange_rate,
      @category_id, @title, @note, @tags,
      @transaction_date, @transaction_time,
      @is_recurring, @recurring_interval
    )
  `),

  selectOne: db.prepare(`
    SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.id = ? AND t.is_deleted = 0
     LIMIT 1
  `),

  softDelete: db.prepare(
    "UPDATE transactions SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?"
  ),

  // Tag helpers
  findTag: db.prepare(
    'SELECT id, usage_count FROM transaction_tags WHERE user_id = ? AND name = ? LIMIT 1'
  ),
  insertTag: db.prepare(
    "INSERT INTO transaction_tags (user_id, name, usage_count) VALUES (?, ?, 1)"
  ),
  bumpTag: db.prepare(
    'UPDATE transaction_tags SET usage_count = usage_count + 1 WHERE id = ?'
  ),
  decrementTag: db.prepare(
    'UPDATE transaction_tags SET usage_count = MAX(usage_count - 1, 0) WHERE user_id = ? AND name = ?'
  ),
  listTags: db.prepare(`
    SELECT id, name, color, usage_count
      FROM transaction_tags
     WHERE user_id = ?
     ORDER BY usage_count DESC, name ASC
  `),

  insertRecurringAlert: db.prepare(`
    INSERT INTO recurring_alerts (user_id, transaction_id, next_expected)
    VALUES (?, ?, ?)
  `),
  deleteRecurringAlert: db.prepare(
    'DELETE FROM recurring_alerts WHERE transaction_id = ?'
  ),
  recurringList: db.prepare(`
    SELECT t.id, t.title, t.amount, t.type,
           t.recurring_interval,
           t.transaction_date AS last_date,
           c.id  AS category_id,
           c.name AS category_name,
           c.icon AS category_icon,
           c.color AS category_color,
           ra.next_expected
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN recurring_alerts ra ON ra.transaction_id = t.id
     WHERE t.user_id = ? AND t.is_recurring = 1 AND t.is_deleted = 0
     ORDER BY ra.next_expected ASC, t.transaction_date DESC
  `),
};

// ────────────────────────────── Helpers ────────────────────────────────────

function isInt(v)      { return Number.isInteger(v); }
function toInt(v)      { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : NaN; }
function clampLimit(v) { const n = Math.min(Math.max(toInt(v) || PAGE_LIMIT_DEFAULT, 1), PAGE_LIMIT_MAX); return n; }

function normalizeTags(input) {
  if (!input) return [];
  let arr = [];
  if (Array.isArray(input)) arr = input.slice();
  else if (typeof input === 'string') arr = input.split(/[,،]/);
  return arr
    .map((s) => String(s).trim().replace(/^#/, ''))
    .filter(Boolean)
    .filter((t) => t.length <= TAG_MAX)
    .slice(0, TAGS_MAX_COUNT);
}

function tagsCsv(tagsArr) {
  return tagsArr.length ? tagsArr.join(',') : null;
}

function shape(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    currency: row.currency || 'IRR',
    amount_original: row.amount_original,
    currency_original: row.currency_original,
    exchange_rate: row.exchange_rate,
    category: row.category_name ? {
      id: row.category_id,
      name: row.category_name,
      icon: row.category_icon,
      color: row.category_color,
    } : { id: row.category_id, name: null, icon: null, color: null },
    title: row.title,
    note: row.note,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    transaction_date: row.transaction_date,
    transaction_time: row.transaction_time,
    is_recurring: row.is_recurring === 1,
    recurring_interval: row.recurring_interval,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function jalaliToGregorian(jStr) {
  if (!JALALI_DATE.test(jStr)) return null;
  const [jy, jm, jd] = jStr.split('-').map(Number);
  try {
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
    return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
  } catch (_) {
    return null;
  }
}

function isProbablyJalali(dateStr) {
  if (!ISO_DATE.test(dateStr)) return false;
  const y = Number(dateStr.slice(0, 4));
  return y < 2000; // 1404, 1403, … vs 2025, 2026
}

function normalizeDateInput(s) {
  // Accept either Gregorian or Jalali — auto-detect by year prefix.
  if (!ISO_DATE.test(s)) return null;
  if (isProbablyJalali(s)) return jalaliToGregorian(s);
  return s;
}

// ────────────────────────────── Validation ────────────────────────────────

function validateCreate(body, userId, opts = {}) {
  const allowPartial = !!opts.partial;
  const errs = [];
  const v = {};

  // type
  if (body.type !== undefined) {
    if (!TYPES.includes(body.type)) errs.push({ field: 'type', message: 'نوع تراکنش نامعتبر است — مقادیر مجاز: income | expense' });
    else v.type = body.type;
  } else if (!allowPartial) errs.push({ field: 'type', message: 'نوع تراکنش الزامی است' });

  // amount
  if (body.amount !== undefined) {
    const amt = toInt(body.amount);
    if (!Number.isFinite(amt) || amt <= 0) errs.push({ field: 'amount', message: 'مبلغ باید بزرگ‌تر از صفر باشد' });
    else if (amt > MAX_AMOUNT) errs.push({ field: 'amount', message: 'مبلغ بسیار بزرگ است' });
    else v.amount = amt;
  } else if (!allowPartial) errs.push({ field: 'amount', message: 'مبلغ الزامی است' });

  // category_id
  if (body.category_id !== undefined) {
    const cid = toInt(body.category_id);
    if (!Number.isFinite(cid) || cid < 1) errs.push({ field: 'category_id', message: 'دسته‌بندی الزامی است' });
    else {
      const cat = stmts.ownCategory.get(cid, userId);
      if (!cat) errs.push({ field: 'category_id', message: 'دسته‌بندی انتخابی معتبر نیست' });
      else if (v.type && cat.type !== 'both' && cat.type !== v.type) {
        errs.push({ field: 'category_id', message: `دسته‌بندی انتخابی با نوع ${v.type === 'income' ? 'درآمد' : 'هزینه'} مطابقت ندارد` });
      } else {
        v.category_id = cid;
      }
    }
  } else if (!allowPartial) errs.push({ field: 'category_id', message: 'دسته‌بندی الزامی است' });

  // title
  if (body.title !== undefined) {
    const t = String(body.title || '').trim();
    if (!t) errs.push({ field: 'title', message: 'عنوان الزامی است' });
    else if (t.length > TITLE_MAX) errs.push({ field: 'title', message: `عنوان نمی‌تواند بیش از ${TITLE_MAX} کاراکتر باشد` });
    else v.title = t;
  } else if (!allowPartial) errs.push({ field: 'title', message: 'عنوان الزامی است' });

  // note
  if (body.note !== undefined) {
    const n = body.note === null ? null : String(body.note || '').trim();
    if (n && n.length > NOTE_MAX) errs.push({ field: 'note', message: `یادداشت نمی‌تواند بیش از ${NOTE_MAX} کاراکتر باشد` });
    else v.note = n || null;
  }

  // tags
  if (body.tags !== undefined) {
    v.tags_arr = normalizeTags(body.tags);
  }

  // date
  if (body.transaction_date !== undefined) {
    const d = normalizeDateInput(String(body.transaction_date || ''));
    if (!d) errs.push({ field: 'transaction_date', message: 'تاریخ نامعتبر است — فرمت YYYY-MM-DD' });
    else v.transaction_date = d;
  } else if (!allowPartial) errs.push({ field: 'transaction_date', message: 'تاریخ الزامی است' });

  // time (optional)
  if (body.transaction_time !== undefined) {
    if (body.transaction_time === null || body.transaction_time === '') v.transaction_time = null;
    else if (!ISO_TIME.test(String(body.transaction_time))) errs.push({ field: 'transaction_time', message: 'ساعت نامعتبر است — فرمت HH:MM' });
    else v.transaction_time = String(body.transaction_time);
  }

  // recurring
  if (body.is_recurring !== undefined) {
    v.is_recurring = (body.is_recurring === true || body.is_recurring === 1 || body.is_recurring === '1') ? 1 : 0;
  }
  if (body.recurring_interval !== undefined) {
    if (body.recurring_interval && !INTERVALS.includes(body.recurring_interval)) {
      errs.push({ field: 'recurring_interval', message: "بازه‌ی تکرار باید 'weekly' | 'monthly' | 'yearly' باشد" });
    } else {
      v.recurring_interval = body.recurring_interval || null;
    }
  }
  if (v.is_recurring === 1 && !v.recurring_interval) {
    errs.push({ field: 'recurring_interval', message: 'برای تراکنش تکراری، انتخاب بازه‌ی تکرار الزامی است' });
  }

  return { ok: errs.length === 0, errors: errs, value: v };
}

// ────────────────────────────── Tag bookkeeping ───────────────────────────

function attachTags(userId, tagsArr) {
  if (!tagsArr || !tagsArr.length) return;
  for (const name of tagsArr) {
    const existing = stmts.findTag.get(userId, name);
    if (existing) stmts.bumpTag.run(existing.id);
    else stmts.insertTag.run(userId, name);
  }
}

function detachTags(userId, tagsArr) {
  if (!tagsArr || !tagsArr.length) return;
  for (const name of tagsArr) {
    try { stmts.decrementTag.run(userId, name); } catch (_) { /* ignore */ }
  }
}

// ============================================================
//             GET /api/transactions
// ============================================================

function listEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const q = req.query || {};

    const page = Math.max(1, toInt(q.page) || 1);
    const limit = clampLimit(q.limit);
    const offset = (page - 1) * limit;

    const filters = ['t.user_id = ?', 't.is_deleted = 0'];
    const params = [userId];

    if (q.type && TYPES.includes(q.type)) {
      filters.push('t.type = ?');
      params.push(q.type);
    }
    if (q.category_id) {
      const cid = toInt(q.category_id);
      if (Number.isFinite(cid)) { filters.push('t.category_id = ?'); params.push(cid); }
    }
    if (q.month && ISO_MONTH.test(q.month)) {
      filters.push("t.transaction_date LIKE ?"); params.push(q.month + '-%');
    } else {
      if (q.date_from && ISO_DATE.test(q.date_from)) { filters.push('t.transaction_date >= ?'); params.push(q.date_from); }
      if (q.date_to   && ISO_DATE.test(q.date_to))   { filters.push('t.transaction_date <= ?'); params.push(q.date_to); }
    }
    if (q.tag) {
      filters.push("(',' || t.tags || ',') LIKE ?");
      params.push(`%,${String(q.tag).trim()},%`);
    }
    if (q.search) {
      const like = `%${String(q.search).trim()}%`;
      filters.push('(t.title LIKE ? OR t.note LIKE ?)');
      params.push(like, like);
    }

    const where = filters.join(' AND ');
    const countSql = `SELECT COUNT(*) AS c FROM transactions t WHERE ${where}`;
    const total = db.prepare(countSql).get(...params).c;

    const listSql = `
      SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${where}
       ORDER BY t.transaction_date DESC, t.created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = db.prepare(listSql).all(...params);

    // Summary over the SAME filter scope.
    const sumSql = `
      SELECT t.type AS type, COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
       WHERE ${where}
       GROUP BY t.type
    `;
    const sums = db.prepare(sumSql).all(...params);
    let total_income = 0, total_expense = 0;
    for (const r of sums) {
      if (r.type === 'income')  total_income  = r.total;
      if (r.type === 'expense') total_expense = r.total;
    }

    return res.json({
      transactions: rows.map(shape),
      pagination: {
        page, limit, total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
      summary: {
        total_income,
        total_expense,
        balance: total_income - total_expense,
      },
    });
  } catch (err) {
    console.error('[transactions.list]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             GET /api/transactions/:id
// ============================================================

function getOneEndpoint(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!Number.isFinite(id) || id < 1) return res.status(400).json({ message: 'شناسه نامعتبر' });
    const row = stmts.selectOne.get(id);
    if (!row) return res.status(404).json({ message: 'تراکنش یافت نشد' });
    if (row.user_id !== req.session.user_id) return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    return res.json({ transaction: shape(row) });
  } catch (err) {
    console.error('[transactions.getOne]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             POST /api/transactions
// ============================================================

function createEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const v = validateCreate(req.body || {}, userId, { partial: false });
    if (!v.ok) {
      const first = v.errors[0];
      return res.status(first.field === 'note' || first.field === 'title' ? 422 : 400)
        .json({ message: first.message, errors: v.errors });
    }
    const tagsArr = v.value.tags_arr || [];
    const tags = tagsCsv(tagsArr);

    let inserted;
    const tx = db.transaction(() => {
      const info = stmts.insertTx.run({
        user_id: userId,
        type: v.value.type,
        amount: v.value.amount,
        currency: 'IRR',
        amount_original: null,
        currency_original: null,
        exchange_rate: null,
        category_id: v.value.category_id,
        title: v.value.title,
        note: v.value.note || null,
        tags,
        transaction_date: v.value.transaction_date,
        transaction_time: v.value.transaction_time || null,
        is_recurring: v.value.is_recurring || 0,
        recurring_interval: (v.value.is_recurring === 1) ? (v.value.recurring_interval || null) : null,
      });
      inserted = Number(info.lastInsertRowid);
      attachTags(userId, tagsArr);
      if (v.value.is_recurring === 1 && v.value.recurring_interval) {
        const next = calculateNextDate(v.value.transaction_date, v.value.recurring_interval);
        stmts.insertRecurringAlert.run(userId, inserted, next);
      }
    });
    tx();

    // Phase 6 — budget alert (silent no-op if budgets table not present).
    try {
      const month = v.value.transaction_date.slice(0, 7);
      setImmediate(() => checkBudgetAlert(userId, v.value.category_id, month));
    } catch (_) { /* ignore */ }

    const row = stmts.selectOne.get(inserted);
    return res.status(201).json({ success: true, transaction: shape(row) });
  } catch (err) {
    console.error('[transactions.create]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             PATCH /api/transactions/:id
// ============================================================

function patchEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const id = toInt(req.params.id);
    if (!Number.isFinite(id) || id < 1) return res.status(400).json({ message: 'شناسه نامعتبر' });
    const existing = stmts.selectOne.get(id);
    if (!existing) return res.status(404).json({ message: 'تراکنش یافت نشد' });
    if (existing.user_id !== userId) return res.status(403).json({ message: 'دسترسی غیرمجاز' });

    const v = validateCreate(req.body || {}, userId, { partial: true });
    if (!v.ok) {
      const first = v.errors[0];
      return res.status(400).json({ message: first.message, errors: v.errors });
    }

    // Build dynamic UPDATE.
    const sets = [];
    const args = [];
    const setIf = (field, val) => { sets.push(`${field} = ?`); args.push(val); };

    if (v.value.type !== undefined)               setIf('type', v.value.type);
    if (v.value.amount !== undefined)             setIf('amount', v.value.amount);
    if (v.value.category_id !== undefined)        setIf('category_id', v.value.category_id);
    if (v.value.title !== undefined)              setIf('title', v.value.title);
    if (v.value.note !== undefined)               setIf('note', v.value.note);
    if (v.value.transaction_date !== undefined)   setIf('transaction_date', v.value.transaction_date);
    if (v.value.transaction_time !== undefined)   setIf('transaction_time', v.value.transaction_time);

    // Tags
    let oldTagsArr = existing.tags ? existing.tags.split(',').filter(Boolean) : [];
    let newTagsArr = oldTagsArr;
    if (v.value.tags_arr !== undefined) {
      newTagsArr = v.value.tags_arr;
      setIf('tags', tagsCsv(newTagsArr));
    }

    // Recurring
    const wasRecurring = existing.is_recurring === 1;
    const willBeRecurring =
      v.value.is_recurring !== undefined ? v.value.is_recurring === 1 : wasRecurring;
    const newInterval =
      v.value.recurring_interval !== undefined ? v.value.recurring_interval : existing.recurring_interval;
    if (willBeRecurring && !newInterval) {
      return res.status(400).json({ message: 'برای تراکنش تکراری، انتخاب بازه‌ی تکرار الزامی است' });
    }
    if (v.value.is_recurring !== undefined) setIf('is_recurring', willBeRecurring ? 1 : 0);
    if (v.value.recurring_interval !== undefined) setIf('recurring_interval', willBeRecurring ? newInterval : null);

    if (!sets.length) {
      return res.json({ success: true, transaction: shape(existing) });
    }
    sets.push("updated_at = datetime('now')");
    args.push(id);

    const tx = db.transaction(() => {
      db.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`).run(...args);
      // Diff tags
      if (v.value.tags_arr !== undefined) {
        const oldSet = new Set(oldTagsArr);
        const newSet = new Set(newTagsArr);
        const added = newTagsArr.filter((t) => !oldSet.has(t));
        const removed = oldTagsArr.filter((t) => !newSet.has(t));
        attachTags(userId, added);
        detachTags(userId, removed);
      }
      // Recurring alert sync
      stmts.deleteRecurringAlert.run(id); // simplest: replace
      if (willBeRecurring && newInterval) {
        const dateForCalc = v.value.transaction_date || existing.transaction_date;
        stmts.insertRecurringAlert.run(userId, id, calculateNextDate(dateForCalc, newInterval));
      }
    });
    tx();

    const updated = stmts.selectOne.get(id);
    try {
      const month = (updated.transaction_date || existing.transaction_date).slice(0, 7);
      setImmediate(() => checkBudgetAlert(userId, updated.category_id, month));
    } catch (_) { /* ignore */ }

    return res.json({ success: true, transaction: shape(updated) });
  } catch (err) {
    console.error('[transactions.patch]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             DELETE /api/transactions/:id
// ============================================================

function deleteEndpoint(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!Number.isFinite(id) || id < 1) return res.status(400).json({ message: 'شناسه نامعتبر' });
    const existing = stmts.selectOne.get(id);
    if (!existing) return res.status(404).json({ message: 'تراکنش یافت نشد' });
    if (existing.user_id !== req.session.user_id) return res.status(403).json({ message: 'دسترسی غیرمجاز' });

    const tx = db.transaction(() => {
      stmts.softDelete.run(id);
      stmts.deleteRecurringAlert.run(id);
      if (existing.tags) {
        detachTags(existing.user_id, existing.tags.split(',').filter(Boolean));
      }
    });
    tx();
    return res.json({ success: true, message: 'تراکنش حذف شد' });
  } catch (err) {
    console.error('[transactions.delete]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             POST /api/transactions/bulk-delete
// ============================================================

function bulkDeleteEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const ids = (req.body && Array.isArray(req.body.ids)) ? req.body.ids.map(toInt).filter((n) => Number.isFinite(n) && n > 0) : [];
    if (!ids.length) return res.status(400).json({ message: 'لیست شناسه‌ها خالی است' });

    let deleted = 0;
    const tx = db.transaction(() => {
      for (const id of ids) {
        const row = stmts.selectOne.get(id);
        if (!row || row.user_id !== userId) continue;
        stmts.softDelete.run(id);
        stmts.deleteRecurringAlert.run(id);
        if (row.tags) detachTags(userId, row.tags.split(',').filter(Boolean));
        deleted += 1;
      }
    });
    tx();
    return res.json({ success: true, deleted_count: deleted });
  } catch (err) {
    console.error('[transactions.bulkDelete]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             POST /api/transactions/import (multipart CSV)
// ============================================================

function importEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    if (!req.file) return res.status(400).json({ message: 'فایل ارسال نشده است' });
    const lower = (req.file.originalname || '').toLowerCase();
    const isCsv   = lower.endsWith('.csv');
    const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');
    if (!isCsv && !isExcel) {
      return res.status(400).json({ message: 'فرمت فایل نامعتبر است — فقط CSV یا Excel پذیرفته می‌شود' });
    }
    if (!req.file.buffer || !req.file.buffer.length) {
      return res.status(400).json({ message: 'فایل خالی است' });
    }

    // Normalize to an array of row objects with our expected Persian headers.
    let parsedData;
    try {
      if (isExcel) {
        const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) return res.status(400).json({ message: 'هیچ شیتی در فایل اکسل وجود ندارد' });
        const ws = wb.Sheets[sheetName];
        // defval keeps empty cells as '' instead of dropping the key entirely,
        // raw:false converts cells to strings (so dates/numbers come as text).
        parsedData = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      } else {
        const text = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
        if (!text) return res.status(400).json({ message: 'فایل خالی است' });
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        parsedData = parsed.data;
      }
    } catch (parseErr) {
      console.error('[transactions.import.parse]', parseErr);
      return res.status(400).json({ message: 'فایل قابل پردازش نیست — فرمت آن را بررسی کنید' });
    }

    if (!parsedData || !parsedData.length) {
      return res.status(400).json({ message: 'هیچ ردیف معتبری در فایل یافت نشد' });
    }
    const parsed = { data: parsedData };

    const errors = [];
    const warnings = [];
    const inserts = [];

    const fallbackId = (stmts.fallbackCategory.get() || {}).id || null;

    for (let i = 0; i < parsed.data.length; i++) {
      const rowNo = i + 2; // header + 1-indexed
      const row = parsed.data[i] || {};

      const typeFa  = String(row['نوع'] || '').trim();
      const title   = String(row['عنوان'] || '').trim();
      const amtRaw  = String(row['مبلغ (تومان)'] || row['مبلغ'] || '').replace(/[,،\s]/g, '');
      const catName = String(row['دسته‌بندی'] || '').trim();
      const dateRaw = String(row['تاریخ (YYYY-MM-DD)'] || row['تاریخ'] || '').trim();
      const note    = String(row['یادداشت'] || '').trim();
      const tagsRaw = String(row['تگ‌ها'] || row['تگها'] || '').trim();
      const recFa   = String(row['تکراری'] || '').trim();

      let type;
      if (typeFa === 'درآمد') type = 'income';
      else if (typeFa === 'هزینه') type = 'expense';
      else { errors.push({ row: rowNo, message: 'نوع تراکنش نامعتبر — مقدار قابل قبول: درآمد یا هزینه' }); continue; }

      if (!title) { errors.push({ row: rowNo, message: 'عنوان الزامی است' }); continue; }
      if (title.length > TITLE_MAX) { errors.push({ row: rowNo, message: `عنوان نمی‌تواند بیش از ${TITLE_MAX} کاراکتر باشد` }); continue; }

      const amt = toInt(amtRaw);
      if (!Number.isFinite(amt) || amt <= 0) { errors.push({ row: rowNo, message: 'مبلغ نامعتبر' }); continue; }
      if (amt > MAX_AMOUNT) { errors.push({ row: rowNo, message: 'مبلغ بسیار بزرگ' }); continue; }

      const dateG = normalizeDateInput(dateRaw);
      if (!dateG) { errors.push({ row: rowNo, message: 'تاریخ نامعتبر — فرمت YYYY-MM-DD' }); continue; }

      let category_id;
      if (catName) {
        const cat = stmts.defaultCategoryByName.get(catName, userId);
        if (cat) {
          if (cat.type !== 'both' && cat.type !== type) {
            warnings.push({ row: rowNo, message: `دسته‌بندی «${catName}» با نوع تراکنش مطابقت ندارد — متفرقه استفاده شد` });
            category_id = fallbackId;
          } else {
            category_id = cat.id;
          }
        } else {
          warnings.push({ row: rowNo, message: 'دسته‌بندی یافت نشد — متفرقه استفاده شد' });
          category_id = fallbackId;
        }
      } else {
        warnings.push({ row: rowNo, message: 'دسته‌بندی خالی — متفرقه استفاده شد' });
        category_id = fallbackId;
      }
      if (!category_id) { errors.push({ row: rowNo, message: 'دسته‌ی پیش‌فرض «متفرقه» در سیستم وجود ندارد' }); continue; }

      const tagsArr = normalizeTags(tagsRaw);
      const is_recurring = recFa === 'بله' ? 1 : 0;
      const recurring_interval = is_recurring ? 'monthly' : null;

      inserts.push({
        user_id: userId,
        type, amount: amt, currency: 'IRR',
        amount_original: null, currency_original: null, exchange_rate: null,
        category_id,
        title: title.slice(0, TITLE_MAX),
        note: note ? note.slice(0, NOTE_MAX) : null,
        tags: tagsCsv(tagsArr),
        transaction_date: dateG,
        transaction_time: null,
        is_recurring, recurring_interval,
        _tagsArr: tagsArr,
      });
    }

    let importedCount = 0;
    if (inserts.length) {
      const tx = db.transaction((rows) => {
        for (const r of rows) {
          const { _tagsArr, ...payload } = r;
          const info = stmts.insertTx.run(payload);
          const newId = Number(info.lastInsertRowid);
          attachTags(userId, _tagsArr);
          if (payload.is_recurring) {
            stmts.insertRecurringAlert.run(userId, newId, calculateNextDate(payload.transaction_date, payload.recurring_interval || 'monthly'));
          }
          importedCount += 1;
        }
      });
      tx(inserts);
    }

    return res.json({
      success: true,
      imported: importedCount,
      failed: errors.length,
      errors,
      warnings,
    });
  } catch (err) {
    console.error('[transactions.import]', err);
    return res.status(500).json({ message: 'خطای سرور هنگام پردازش فایل' });
  }
}

// ============================================================
//             GET /api/transactions/sample-csv
// ============================================================

function sampleCsvEndpoint(_req, res) {
  try {
    if (!fs.existsSync(SAMPLE_CSV_PATH)) {
      return res.status(404).json({ message: 'فایل نمونه در دسترس نیست' });
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dakhlyar_sample.csv"');
    // UTF-8 BOM so Excel opens Persian headers correctly.
    res.write('\uFEFF');
    fs.createReadStream(SAMPLE_CSV_PATH).pipe(res);
  } catch (err) {
    console.error('[transactions.sampleCsv]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             GET /api/transactions/tags
// ============================================================

function tagsEndpoint(req, res) {
  try {
    return res.json({ tags: stmts.listTags.all(req.session.user_id) });
  } catch (err) {
    console.error('[transactions.tags]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             GET /api/transactions/summary
// ============================================================

function summaryEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const month = (req.query && ISO_MONTH.test(req.query.month)) ? req.query.month : (() => {
      const d = new Date();
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    })();
    const like = `${month}-%`;

    const sums = db.prepare(`
      SELECT type, COALESCE(SUM(amount),0) AS total
        FROM transactions
       WHERE user_id = ? AND is_deleted = 0 AND transaction_date LIKE ?
       GROUP BY type
    `).all(userId, like);
    let total_income = 0, total_expense = 0;
    for (const r of sums) {
      if (r.type === 'income') total_income = r.total;
      if (r.type === 'expense') total_expense = r.total;
    }

    const top = db.prepare(`
      SELECT c.id AS category_id, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
             COALESCE(SUM(t.amount),0) AS total
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.is_deleted = 0 AND t.type = 'expense' AND t.transaction_date LIKE ?
       GROUP BY t.category_id
       ORDER BY total DESC
       LIMIT 3
    `).all(userId, like);
    const top_categories = top.map((r) => ({
      category_id: r.category_id,
      category_name: r.category_name,
      category_icon: r.category_icon,
      category_color: r.category_color,
      total: r.total,
      percentage: total_expense > 0 ? Math.round((r.total / total_expense) * 100) : 0,
    }));

    const recurring_count = db.prepare(`
      SELECT COUNT(DISTINCT t.id) AS c
        FROM transactions t
       WHERE t.user_id = ? AND t.is_recurring = 1 AND t.is_deleted = 0
         AND t.transaction_date LIKE ?
    `).get(userId, like).c;

    // recurring monthly subscriptions detector
    const subs = db.prepare(`
      SELECT t.title, t.amount,
             (SELECT ra.next_expected FROM recurring_alerts ra WHERE ra.transaction_id = t.id LIMIT 1) AS next_expected
        FROM transactions t
       WHERE t.user_id = ?
         AND t.is_deleted = 0
         AND t.is_recurring = 1
         AND t.type = 'expense'
         AND t.recurring_interval = 'monthly'
    `).all(userId);
    const recurring_subscriptions = {
      count: subs.length,
      total_monthly: subs.reduce((acc, s) => acc + Number(s.amount || 0), 0),
      items: subs.slice(0, 10),
    };

    return res.json({
      month,
      total_income,
      total_expense,
      balance: total_income - total_expense,
      top_categories,
      recurring_count,
      recurring_subscriptions,
    });
  } catch (err) {
    console.error('[transactions.summary]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             GET /api/transactions/recurring
// ============================================================

function recurringEndpoint(req, res) {
  try {
    const rows = stmts.recurringList.all(req.session.user_id);
    return res.json({
      recurring: rows.map((r) => ({
        id: r.id,
        title: r.title,
        amount: r.amount,
        type: r.type,
        category: {
          id: r.category_id,
          name: r.category_name,
          icon: r.category_icon,
          color: r.category_color,
        },
        recurring_interval: r.recurring_interval,
        last_date: r.last_date,
        next_expected: r.next_expected,
      })),
    });
  } catch (err) {
    console.error('[transactions.recurring]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listEndpoint,
  getOneEndpoint,
  createEndpoint,
  patchEndpoint,
  deleteEndpoint,
  bulkDeleteEndpoint,
  importEndpoint,
  sampleCsvEndpoint,
  tagsEndpoint,
  summaryEndpoint,
  recurringEndpoint,
};
