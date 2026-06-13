'use strict';

const db = require('../db/appDb');
const { checkBudgetAlert } = require('../utils/recurringHelper');
const { currentMonth, parseMonth, prevMonth, monthRange } = require('../utils/monthHelper');
const { invalidateScore } = require('../utils/scoreHelper');

const stmts = {
  ownCategory: db.prepare(`
    SELECT id, name, icon, color, type FROM categories
     WHERE id = ? AND is_active = 1
       AND ((is_default = 1 AND user_id IS NULL) OR (is_default = 0 AND user_id = ?))
     LIMIT 1
  `),
  budgetsForMonth: db.prepare(`
    SELECT b.id, b.category_id, b.month, b.amount,
           c.name, c.icon, c.color
      FROM budgets b
      JOIN categories c ON c.id = b.category_id
     WHERE b.user_id = ? AND b.month = ?
     ORDER BY c.name
  `),
  spentForCategory: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS spent
      FROM transactions
     WHERE user_id = ? AND category_id = ? AND type = 'expense'
       AND is_deleted = 0 AND transaction_date LIKE ?
  `),
  upsertBudget: db.prepare(`
    INSERT INTO budgets (user_id, category_id, month, amount, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, category_id, month) DO UPDATE SET
      amount = excluded.amount,
      updated_at = datetime('now')
  `),
  getBudget: db.prepare(`
    SELECT id, category_id, month, amount FROM budgets
     WHERE user_id = ? AND category_id = ? AND month = ?
  `),
  ownBudget: db.prepare(`
    SELECT id FROM budgets WHERE id = ? AND user_id = ? LIMIT 1
  `),
  deleteBudget: db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?'),
  totalBudgeted: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM budgets WHERE user_id = ? AND month = ?
  `),
  monthIncome: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
     WHERE user_id = ? AND type = 'income' AND is_deleted = 0
       AND transaction_date >= ? AND transaction_date <= ?
  `),
  prevMonthBudgets: db.prepare(`
    SELECT category_id, amount FROM budgets WHERE user_id = ? AND month = ?
  `),
  hasBudget: db.prepare(`
    SELECT 1 FROM budgets WHERE user_id = ? AND category_id = ? AND month = ? LIMIT 1
  `),
};

function budgetStatus(spent, amount) {
  if (amount <= 0) return 'ok';
  const pct = (spent / amount) * 100;
  if (pct >= 100) return 'exceeded';
  if (pct >= 80) return 'warning';
  return 'ok';
}

function enrichBudgetRow(userId, row, month) {
  const spent = Number(stmts.spentForCategory.get(userId, row.category_id, `${month}-%`).spent);
  const amount = Number(row.amount);
  const remaining = Math.max(0, amount - spent);
  const percentage = amount > 0 ? Math.min(999, Math.round((spent / amount) * 100)) : 0;
  return {
    id: row.id,
    category: {
      id: row.category_id,
      name: row.name,
      icon: row.icon,
      color: row.color,
    },
    amount,
    spent,
    remaining,
    percentage,
    status: budgetStatus(spent, amount),
  };
}

function getBudgetsEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const month = parseMonth(req.query.month);
    if (!month) return res.status(400).json({ message: 'فرمت ماه نامعتبر است — YYYY-MM' });

    const rows = stmts.budgetsForMonth.all(userId, month);
    const budgets = rows.map((r) => enrichBudgetRow(userId, r, month));
    const total_budgeted = budgets.reduce((s, b) => s + b.amount, 0);
    const total_spent = budgets.reduce((s, b) => s + b.spent, 0);

    res.json({
      month,
      total_budgeted,
      total_spent,
      total_remaining: Math.max(0, total_budgeted - total_spent),
      budgets,
    });
  } catch (err) {
    console.error('[budgets.getBudgets]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function createBudgetEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const category_id = Number(req.body.category_id);
    const month = parseMonth(req.body.month);
    const amount = Number(req.body.amount);

    if (!month) return res.status(400).json({ message: 'فرمت ماه نامعتبر است' });
    if (!Number.isInteger(category_id) || category_id <= 0) {
      return res.status(400).json({ message: 'دسته‌بندی انتخابی معتبر نیست' });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: 'مبلغ بودجه باید بزرگ‌تر از صفر باشد' });
    }

    const cat = stmts.ownCategory.get(category_id, userId);
    if (!cat) return res.status(400).json({ message: 'دسته‌بندی انتخابی معتبر نیست' });
    if (cat.type === 'income') {
      return res.status(400).json({ message: 'بودجه فقط برای دسته‌های هزینه قابل تنظیم است' });
    }

    stmts.upsertBudget.run(userId, category_id, month, amount);
    const budget = stmts.getBudget.get(userId, category_id, month);
    checkBudgetAlert(userId, category_id, month);
    invalidateScore(userId, month);

    res.json({ success: true, budget });
  } catch (err) {
    console.error('[budgets.create]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function bulkBudgetsEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const month = parseMonth(req.body.month);
    const list = req.body.budgets;

    if (!month) return res.status(400).json({ message: 'فرمت ماه نامعتبر است' });
    if (!Array.isArray(list) || !list.length) {
      return res.status(400).json({ message: 'لیست بودجه‌ها خالی است' });
    }

    let saved = 0;
    const tx = db.transaction((items) => {
      for (const item of items) {
        const category_id = Number(item.category_id);
        const amount = Number(item.amount);
        if (!Number.isInteger(category_id) || category_id <= 0) continue;
        if (!Number.isInteger(amount) || amount <= 0) continue;
        const cat = stmts.ownCategory.get(category_id, userId);
        if (!cat || cat.type === 'income') continue;
        stmts.upsertBudget.run(userId, category_id, month, amount);
        checkBudgetAlert(userId, category_id, month);
        saved += 1;
      }
    });
    tx(list);
    invalidateScore(userId, month);

    res.json({
      success: true,
      saved,
      message: 'بودجه‌ها با موفقیت ذخیره شدند',
    });
  } catch (err) {
    console.error('[budgets.bulk]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function deleteBudgetEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    const row = stmts.ownBudget.get(id, userId);
    if (!row) return res.status(404).json({ message: 'بودجه یافت نشد' });

    stmts.deleteBudget.run(id, userId);
    invalidateScore(userId, currentMonth());
    res.json({ success: true });
  } catch (err) {
    console.error('[budgets.delete]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function zbbEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const month = parseMonth(req.query.month);
    if (!month) return res.status(400).json({ message: 'فرمت ماه نامعتبر است' });

    const { from, to } = monthRange(month);
    const total_income = Number(stmts.monthIncome.get(userId, from, to).total);
    const total_budgeted = Number(stmts.totalBudgeted.get(userId, month).total);
    const unassigned = Math.max(0, total_income - total_budgeted);
    const assignment_percent = total_income > 0
      ? Math.min(100, Math.round((total_budgeted / total_income) * 100))
      : 0;

    res.json({
      month,
      total_income,
      total_budgeted,
      unassigned,
      is_zero_based: total_income > 0 && unassigned === 0,
      assignment_percent,
    });
  } catch (err) {
    console.error('[budgets.zbb]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function copyFromLastMonthEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const target = parseMonth(req.body.target_month);
    if (!target) return res.status(400).json({ message: 'فرمت ماه نامعتبر است' });

    const source = prevMonth(target);
    const prevRows = stmts.prevMonthBudgets.all(userId, source);
    if (!prevRows.length) {
      return res.status(404).json({ message: 'بودجه‌ای برای ماه قبل یافت نشد' });
    }

    let copied = 0;
    const tx = db.transaction((rows) => {
      for (const r of rows) {
        if (stmts.hasBudget.get(userId, r.category_id, target)) continue;
        stmts.upsertBudget.run(userId, r.category_id, target, r.amount);
        copied += 1;
      }
    });
    tx(prevRows);
    invalidateScore(userId, target);

    res.json({ success: true, copied });
  } catch (err) {
    console.error('[budgets.copy]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  getBudgetsEndpoint,
  createBudgetEndpoint,
  bulkBudgetsEndpoint,
  deleteBudgetEndpoint,
  zbbEndpoint,
  copyFromLastMonthEndpoint,
};
