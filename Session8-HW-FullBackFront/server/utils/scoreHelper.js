'use strict';

const db = require('../db/appDb');
const { currentMonth, monthRange } = require('./monthHelper');

const LABELS = [
  { min: 90, label: 'استاد مالی', color: '#F0B429' },
  { min: 80, label: 'عالی', color: '#1A5C3A' },
  { min: 60, label: 'خوب', color: '#3B82F6' },
  { min: 40, label: 'در حال پیشرفت', color: '#F59E0B' },
  { min: 0, label: 'نیاز به بهبود', color: '#DC2626' },
];

function scoreLabel(score) {
  for (const row of LABELS) {
    if (score >= row.min) return { label: row.label, color: row.color };
  }
  return LABELS[LABELS.length - 1];
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round(n) {
  return Math.round(n);
}

const stmts = {
  monthIncome: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
     WHERE user_id = ? AND type = 'income' AND is_deleted = 0
       AND transaction_date >= ? AND transaction_date <= ?
  `),
  monthExpense: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
     WHERE user_id = ? AND type = 'expense' AND is_deleted = 0
       AND transaction_date >= ? AND transaction_date <= ?
  `),
  budgetsForMonth: db.prepare(`
    SELECT b.category_id, b.amount,
           COALESCE((
             SELECT SUM(t.amount) FROM transactions t
              WHERE t.user_id = b.user_id AND t.category_id = b.category_id
                AND t.type = 'expense' AND t.is_deleted = 0
                AND t.transaction_date LIKE ?
           ), 0) AS spent
      FROM budgets b
     WHERE b.user_id = ? AND b.month = ?
  `),
  totalBudgeted: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM budgets WHERE user_id = ? AND month = ?
  `),
  activeDays: db.prepare(`
    SELECT COUNT(DISTINCT transaction_date) AS c
      FROM transactions
     WHERE user_id = ? AND is_deleted = 0
       AND transaction_date >= ? AND transaction_date <= ?
  `),
  recurringCount: db.prepare(`
    SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS total
      FROM transactions
     WHERE user_id = ? AND is_deleted = 0 AND is_recurring = 1 AND type = 'expense'
  `),
  upsertScore: db.prepare(`
    INSERT INTO financial_scores (user_id, month, score, breakdown, calculated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, month) DO UPDATE SET
      score = excluded.score,
      breakdown = excluded.breakdown,
      calculated_at = datetime('now')
  `),
  getScore: db.prepare(`
    SELECT score, breakdown, month FROM financial_scores
     WHERE user_id = ? AND month = ? LIMIT 1
  `),
  scoreHistory: db.prepare(`
    SELECT month, score FROM financial_scores
     WHERE user_id = ? AND month != ?
     ORDER BY month DESC LIMIT 6
  `),
};

function componentBudgetAdherence(userId, month) {
  const rows = stmts.budgetsForMonth.all(`${month}-%`, userId, month);
  if (!rows.length) {
    return { score: 15, max: 30, label: 'رعایت بودجه', detail: 'بودجه‌ای تنظیم نشده' };
  }
  let totalWeight = 0;
  let earned = 0;
  for (const r of rows) {
    const budget = Number(r.amount);
    const spent = Number(r.spent);
    if (budget <= 0) continue;
    totalWeight += budget;
    const ratio = spent / budget;
    const catScore = ratio <= 1 ? (1 - ratio) : 0;
    earned += catScore * budget;
  }
  const score = totalWeight > 0 ? round((earned / totalWeight) * 30) : 15;
  return { score: clamp(score, 0, 30), max: 30, label: 'رعایت بودجه' };
}

function componentSavingsRate(userId, month) {
  const { from, to } = monthRange(month);
  const income = Number(stmts.monthIncome.get(userId, from, to).total);
  const expense = Number(stmts.monthExpense.get(userId, from, to).total);
  if (income <= 0) {
    return { score: 10, max: 25, label: 'نرخ پس‌انداز', detail: 'درآمد ثبت نشده' };
  }
  const rate = (income - expense) / income;
  let score = 0;
  if (rate >= 0.3) score = 25;
  else if (rate >= 0.2) score = 18;
  else if (rate >= 0.1) score = 10;
  else if (rate > 0) score = round(rate * 100);
  return { score: clamp(score, 0, 25), max: 25, label: 'نرخ پس‌انداز' };
}

function componentTransactionConsistency(userId, month) {
  const { from, to } = monthRange(month);
  const days = Number(stmts.activeDays.get(userId, from, to).c || 0);
  const score = round(Math.min(20, (days / 20) * 20));
  return { score, max: 20, label: 'ثبت منظم تراکنش‌ها', active_days: days };
}

function componentZeroBased(userId, month) {
  const { from, to } = monthRange(month);
  const income = Number(stmts.monthIncome.get(userId, from, to).total);
  const budgeted = Number(stmts.totalBudgeted.get(userId, month).total);
  if (income <= 0) {
    return { score: 0, max: 15, label: 'تخصیص درآمد', assignment_percent: 0 };
  }
  const pct = Math.min(100, round((budgeted / income) * 100));
  const score = round((pct / 100) * 15);
  return { score: clamp(score, 0, 15), max: 15, label: 'تخصیص درآمد', assignment_percent: pct };
}

function componentRecurringAwareness(userId, month) {
  const { from, to } = monthRange(month);
  const income = Number(stmts.monthIncome.get(userId, from, to).total);
  const rec = stmts.recurringCount.get(userId);
  const count = Number(rec.c || 0);
  const total = Number(rec.total || 0);
  let score = 0;
  if (count >= 1) score += 5;
  if (income > 0 && total < income * 0.3) score += 5;
  else if (income <= 0 && count >= 1) score += 5;
  return { score: clamp(score, 0, 10), max: 10, label: 'آگاهی از هزینه‌های ثابت' };
}

function buildTips(breakdown) {
  const tips = [];
  if (breakdown.budget_adherence.score < breakdown.budget_adherence.max * 0.7) {
    tips.push('برای افزایش امتیاز، بودجه دسته‌بندی‌های پرهزینه را تنظیم کنید');
  }
  if (breakdown.zero_based_progress.score < breakdown.zero_based_progress.max * 0.7) {
    tips.push('درآمد خود را به طور کامل بین دسته‌ها تخصیص دهید');
  }
  if (breakdown.savings_rate.score < breakdown.savings_rate.max * 0.5) {
    tips.push('سعی کنید حداقل ۱۰٪ از درآمد ماهانه را پس‌انداز کنید');
  }
  if (breakdown.transaction_consistency.score < breakdown.transaction_consistency.max * 0.6) {
    tips.push('تراکنش‌ها را منظم‌تر ثبت کنید — حداقل چند بار در هفته');
  }
  if (!tips.length) tips.push('عملکرد مالی شما عالی است — همین‌طور ادامه دهید!');
  return tips.slice(0, 3);
}

function calculateFinancialScore(userId, monthYYYYMM) {
  const month = monthYYYYMM || currentMonth();
  const breakdown = {
    budget_adherence: componentBudgetAdherence(userId, month),
    savings_rate: componentSavingsRate(userId, month),
    transaction_consistency: componentTransactionConsistency(userId, month),
    zero_based_progress: componentZeroBased(userId, month),
    recurring_awareness: componentRecurringAwareness(userId, month),
  };
  const raw =
    breakdown.budget_adherence.score +
    breakdown.savings_rate.score +
    breakdown.transaction_consistency.score +
    breakdown.zero_based_progress.score +
    breakdown.recurring_awareness.score;
  const score = clamp(round(raw), 0, 100);
  const { label, color } = scoreLabel(score);

  stmts.upsertScore.run(userId, month, score, JSON.stringify(breakdown));

  const history = stmts.scoreHistory.all(userId, month).map((r) => ({
    month: r.month,
    score: r.score,
  }));

  return {
    score,
    label,
    color,
    month,
    breakdown,
    history,
    tips: buildTips(breakdown),
  };
}

function invalidateScore(userId, monthYYYYMM) {
  try {
    db.prepare('DELETE FROM financial_scores WHERE user_id = ? AND month = ?').run(
      userId,
      monthYYYYMM || currentMonth()
    );
  } catch (_) { /* ignore */ }
}

module.exports = {
  calculateFinancialScore,
  invalidateScore,
  scoreLabel,
};
