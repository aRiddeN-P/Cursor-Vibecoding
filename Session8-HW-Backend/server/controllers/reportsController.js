'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const jalaali = require('jalaali-js');
const Papa = require('papaparse');

const db = require('../db/appDb');
const { calculateFinancialScore, scoreLabel } = require('../utils/scoreHelper');
const {
  currentMonth,
  parseMonth,
  monthRange,
  parseMonthsList,
  prevMonth,
  daysRemainingInMonth,
  daysElapsedInMonth,
} = require('../utils/monthHelper');

const FONT_REG = path.join(__dirname, '..', 'fonts', 'Vazirmatn-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'fonts', 'Vazirmatn-Bold.ttf');

const PERSIAN_DOW = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const PERSIAN_MONTHS = [
  '', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

function fa(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

function faMoney(n) {
  return fa(Number(n).toLocaleString('en'));
}

function gregToJalaliStr(gDate) {
  const [y, m, d] = gDate.split('-').map(Number);
  const j = jalaali.toJalaali(y, m, d);
  return `${j.jy}-${String(j.jm).padStart(2, '0')}-${String(j.jd).padStart(2, '0')}`;
}

function monthFaLabel(monthYYYYMM) {
  const [y, m] = monthYYYYMM.split('-').map(Number);
  const j = jalaali.toJalaali(y, m, 1);
  return `${PERSIAN_MONTHS[j.jm]} ${fa(j.jy)}`;
}

function persianWeekdayIndex(gDate) {
  const [y, m, d] = gDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const jsDay = dt.getUTCDay();
  return jsDay === 6 ? 0 : jsDay + 1;
}

const stmts = {
  byCategory: db.prepare(`
    SELECT c.id, c.name, c.icon, c.color,
           COALESCE(SUM(t.amount), 0) AS amount,
           COUNT(t.id) AS transaction_count
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.type = ? AND t.is_deleted = 0
       AND t.transaction_date >= ? AND t.transaction_date <= ?
     GROUP BY c.id
     ORDER BY amount DESC
  `),
  monthTotal: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
     WHERE user_id = ? AND type = ? AND is_deleted = 0
       AND transaction_date >= ? AND transaction_date <= ?
  `),
  dailyTotals: db.prepare(`
    SELECT transaction_date AS date, type, COALESCE(SUM(amount), 0) AS amount
      FROM transactions
     WHERE user_id = ? AND is_deleted = 0
       AND transaction_date >= ? AND transaction_date <= ?
     GROUP BY transaction_date, type
  `),
  txCount: db.prepare(`
    SELECT type, COUNT(*) AS c FROM transactions
     WHERE user_id = ? AND is_deleted = 0
       AND transaction_date >= ? AND transaction_date <= ?
     GROUP BY type
  `),
  topExpenseDay: db.prepare(`
    SELECT transaction_date AS date, COALESCE(SUM(amount), 0) AS amount
      FROM transactions
     WHERE user_id = ? AND type = 'expense' AND is_deleted = 0
       AND transaction_date >= ? AND transaction_date <= ?
     GROUP BY transaction_date
     ORDER BY amount DESC LIMIT 1
  `),
  topCategoryInMonth: db.prepare(`
    SELECT c.name, COALESCE(SUM(t.amount), 0) AS amount
      FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.type = 'expense' AND t.is_deleted = 0
       AND t.transaction_date >= ? AND t.transaction_date <= ?
     GROUP BY c.id ORDER BY amount DESC LIMIT 1
  `),
  cumulativeBalance: db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS balance
      FROM transactions WHERE user_id = ? AND is_deleted = 0
  `),
  recurringMonthly: db.prepare(`
    SELECT t.id, t.title, t.amount, t.recurring_interval,
           c.name AS category_name, c.icon AS category_icon,
           ra.next_expected
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN recurring_alerts ra ON ra.transaction_id = t.id
     WHERE t.user_id = ? AND t.type = 'expense' AND t.is_recurring = 1
       AND t.is_deleted = 0 AND t.recurring_interval = 'monthly'
     ORDER BY t.amount DESC
  `),
  exportTx: db.prepare(`
    SELECT t.*, c.name AS category_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.is_deleted = 0
       AND (? IS NULL OR t.transaction_date >= ?)
       AND (? IS NULL OR t.transaction_date <= ?)
     ORDER BY t.transaction_date DESC, t.id DESC
  `),
  topTransactions: db.prepare(`
    SELECT t.title, t.amount, t.transaction_date, c.name AS category_name
      FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.type = 'expense' AND t.is_deleted = 0
       AND t.transaction_date >= ? AND t.transaction_date <= ?
     ORDER BY t.amount DESC LIMIT 5
  `),
  scoreHistoryRows: db.prepare(`
    SELECT month, score FROM financial_scores
     WHERE user_id = ?
     ORDER BY month DESC LIMIT ?
  `),
  expenseByDow: db.prepare(`
    SELECT strftime('%w', transaction_date) AS dow,
           COALESCE(SUM(amount), 0) AS total
      FROM transactions
     WHERE user_id = ? AND type = 'expense' AND is_deleted = 0
       AND transaction_date >= ? AND transaction_date <= ?
     GROUP BY dow
  `),
  categoryExpenseInRange: db.prepare(`
    SELECT c.id, c.name, COALESCE(SUM(t.amount), 0) AS amount
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.type = 'expense' AND t.is_deleted = 0
       AND t.transaction_date >= ? AND t.transaction_date <= ?
       AND c.id = ?
     GROUP BY c.id
  `),
  budgetsWithSpent: db.prepare(`
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
  distinctTxDates: db.prepare(`
    SELECT DISTINCT transaction_date AS d
      FROM transactions
     WHERE user_id = ? AND is_deleted = 0
     ORDER BY transaction_date DESC
     LIMIT 400
  `),
};

function buildCategoryBreakdown(userId, type, from, to) {
  const rows = stmts.byCategory.all(userId, type, from, to);
  const total = rows.reduce((s, r) => s + Number(r.amount), 0) || 0;
  return {
    total,
    by_category: rows.map((r) => ({
      category: { id: r.id, name: r.name, icon: r.icon, color: r.color },
      amount: Number(r.amount),
      percentage: total > 0 ? Math.round((Number(r.amount) / total) * 100) : 0,
      transaction_count: Number(r.transaction_count),
    })),
  };
}

function buildDailyTotals(from, to, rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, { date: r.date, income: 0, expense: 0 });
    const cell = map.get(r.date);
    if (r.type === 'income') cell.income = Number(r.amount);
    else cell.expense = Number(r.amount);
  }
  const out = [];
  const [y, m] = from.slice(0, 7).split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = 1; d <= lastDay; d++) {
    const date = `${from.slice(0, 7)}-${String(d).padStart(2, '0')}`;
    out.push(map.get(date) || { date, income: 0, expense: 0 });
  }
  return out;
}

function monthlyReportEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const month = parseMonth(req.query.month);
    if (!month) return res.status(400).json({ message: 'فرمت ماه نامعتبر است' });

    const { from, to, days } = monthRange(month);
    const income = buildCategoryBreakdown(userId, 'income', from, to);
    const expense = buildCategoryBreakdown(userId, 'expense', from, to);
    const dailyRows = stmts.dailyTotals.all(userId, from, to);
    const daily_totals = buildDailyTotals(from, to, dailyRows);

    const counts = stmts.txCount.all(userId, from, to);
    let incomeCount = 0;
    let expenseCount = 0;
    for (const c of counts) {
      if (c.type === 'income') incomeCount = Number(c.c);
      if (c.type === 'expense') expenseCount = Number(c.c);
    }

    const topDay = stmts.topExpenseDay.get(userId, from, to);
    const avg_daily_expense = days > 0 ? Math.round(expense.total / days) : 0;

    res.json({
      month,
      income,
      expense,
      balance: income.total - expense.total,
      daily_totals,
      top_expense_day: topDay
        ? { date: topDay.date, amount: Number(topDay.amount) }
        : null,
      avg_daily_expense,
      transaction_count: {
        income: incomeCount,
        expense: expenseCount,
        total: incomeCount + expenseCount,
      },
    });
  } catch (err) {
    console.error('[reports.monthly]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function comparisonReportEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const months = parseMonthsList(req.query.months, 6, 3);
    const comparison = months.map((month) => {
      const { from, to } = monthRange(month);
      const income = Number(stmts.monthTotal.get(userId, 'income', from, to).total);
      const expense = Number(stmts.monthTotal.get(userId, 'expense', from, to).total);
      const top = stmts.topCategoryInMonth.get(userId, from, to);
      return {
        month,
        income,
        expense,
        balance: income - expense,
        top_category: top
          ? { name: top.name, amount: Number(top.amount) }
          : null,
      };
    });

    let expense_change_percent = 0;
    let income_change_percent = 0;
    if (comparison.length >= 2) {
      const cur = comparison[comparison.length - 1];
      const prev = comparison[comparison.length - 2];
      if (prev.expense > 0) {
        expense_change_percent = Math.round(((cur.expense - prev.expense) / prev.expense) * 100);
      }
      if (prev.income > 0) {
        income_change_percent = Math.round(((cur.income - prev.income) / prev.income) * 100);
      }
    }

    const last = comparison[comparison.length - 1];
    const prevM = comparison.length >= 2 ? comparison[comparison.length - 2] : null;
    let biggest_increase_category = null;
    let biggest_decrease_category = null;

    if (last && prevM) {
      const { from: f1, to: t1 } = monthRange(last.month);
      const { from: f2, to: t2 } = monthRange(prevM.month);
      const curCats = stmts.byCategory.all(userId, 'expense', f1, t1);
      const prevCats = stmts.byCategory.all(userId, 'expense', f2, t2);
      const prevMap = new Map(prevCats.map((c) => [c.id, Number(c.amount)]));
      let maxInc = -Infinity;
      let maxDec = Infinity;
      for (const c of curCats) {
        const prevAmt = prevMap.get(c.id) || 0;
        const curAmt = Number(c.amount);
        if (prevAmt <= 0) continue;
        const ch = Math.round(((curAmt - prevAmt) / prevAmt) * 100);
        if (ch > maxInc) {
          maxInc = ch;
          biggest_increase_category = { name: c.name, change_percent: ch };
        }
        if (ch < maxDec) {
          maxDec = ch;
          biggest_decrease_category = { name: c.name, change_percent: ch };
        }
      }
    }

    res.json({
      months,
      comparison,
      trends: {
        expense_change_percent,
        income_change_percent,
        biggest_increase_category,
        biggest_decrease_category,
      },
    });
  } catch (err) {
    console.error('[reports.comparison]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function weeklyPatternEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const monthsBack = Math.min(12, Math.max(1, Number(req.query.months) || 3));
    const endMonth = currentMonth();
    const months = [];
    let cur = endMonth;
    for (let i = 0; i < monthsBack; i++) {
      months.push(cur);
      cur = prevMonth(cur);
    }

    const dayNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const buckets = dayNames.map((name, idx) => ({
      day_name: name,
      day_index: idx,
      total_expense: 0,
      transaction_count: 0,
    }));

    for (const month of months) {
      const { from, to } = monthRange(month);
      const rows = db.prepare(`
        SELECT transaction_date, amount FROM transactions
         WHERE user_id = ? AND type = 'expense' AND is_deleted = 0
           AND transaction_date >= ? AND transaction_date <= ?
      `).all(userId, from, to);
      for (const r of rows) {
        const idx = persianWeekdayIndex(r.transaction_date);
        buckets[idx].total_expense += Number(r.amount);
        buckets[idx].transaction_count += 1;
      }
    }

    const days = buckets.map((b) => ({
      ...b,
      avg_expense: b.transaction_count > 0
        ? Math.round(b.total_expense / Math.max(1, monthsBack * 4))
        : 0,
    }));

    const avgAll = days.reduce((s, d) => s + d.avg_expense, 0) / (days.length || 1);
    let peak = days[0];
    for (const d of days) {
      if (d.avg_expense > peak.avg_expense) peak = d;
    }
    const pctAbove = avgAll > 0
      ? Math.round(((peak.avg_expense - avgAll) / avgAll) * 100)
      : 0;
    const peak_day_insight = peak.avg_expense > 0
      ? `بیشترین خرج شما در ${peak.day_name}‌هاست — ${fa(pctAbove)}٪ بیشتر از میانگین روزهای دیگر`
      : 'داده کافی برای تحلیل الگوی هفتگی وجود ندارد';

    res.json({
      days,
      peak_day: peak.day_name,
      peak_day_insight,
    });
  } catch (err) {
    console.error('[reports.weekly]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function cashFlowForecastEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const month = parseMonth(req.query.month) || currentMonth();
    const last3 = parseMonthsList(null, 3, 3);
    let sumInc = 0;
    let sumExp = 0;
    let monthsWithData = 0;
    for (const m of last3) {
      const { from, to } = monthRange(m);
      const inc = Number(stmts.monthTotal.get(userId, 'income', from, to).total);
      const exp = Number(stmts.monthTotal.get(userId, 'expense', from, to).total);
      if (inc + exp > 0) monthsWithData += 1;
      sumInc += inc;
      sumExp += exp;
    }
    const avg_monthly_income = Math.round(sumInc / 3);
    const avg_monthly_expense = Math.round(sumExp / 3);

    const { from, to } = monthRange(month);
    const curInc = Number(stmts.monthTotal.get(userId, 'income', from, to).total);
    const curExp = Number(stmts.monthTotal.get(userId, 'expense', from, to).total);
    const current_balance = curInc - curExp;

    const recurring = stmts.recurringMonthly.all(userId);
    const recurring_this_month = recurring.reduce((s, r) => s + Number(r.amount), 0);

    const days_remaining = daysRemainingInMonth(month);
    const days_elapsed = daysElapsedInMonth(month);
    const { days: totalDays } = monthRange(month);
    const dailyBurn = days_elapsed > 0 ? curExp / days_elapsed : avg_monthly_expense / 30;
    const expected_remaining_expense = Math.round(dailyBurn * days_remaining + recurring_this_month);

    const expected_remaining_income = days_remaining > 0 && avg_monthly_income > curInc
      ? Math.round((avg_monthly_income - curInc) * (days_remaining / Math.max(1, totalDays - days_elapsed)))
      : 0;

    const projected_end_balance = Math.round(
      current_balance + expected_remaining_income - expected_remaining_expense
    );

    let confidence = 'low';
    if (monthsWithData >= 3) confidence = 'high';
    else if (monthsWithData >= 1) confidence = 'medium';

    const insight = `بر اساس الگوی خرج شما، تا پایان ماه احتمالاً ${faMoney(projected_end_balance)} تومان موجودی خواهید داشت.`;

    res.json({
      current_balance,
      projected_end_balance,
      avg_monthly_income,
      avg_monthly_expense,
      days_remaining,
      expected_remaining_expense,
      recurring_this_month,
      confidence,
      insight,
    });
  } catch (err) {
    console.error('[reports.forecast]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function netWorthSnapshotEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const current_balance = Number(stmts.cumulativeBalance.get(userId).balance);

    const months = [];
    let cur = currentMonth();
    for (let i = 0; i < 12; i++) {
      months.unshift(cur);
      cur = prevMonth(cur);
    }

    const monthly_snapshots = months.map((month) => {
      const { from, to } = monthRange(month);
      const row = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN type='income' AND transaction_date <= ? THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN type='expense' AND transaction_date <= ? THEN amount ELSE 0 END), 0) AS balance
          FROM transactions WHERE user_id = ? AND is_deleted = 0
      `).get(to, to, userId);
      return { month, balance: Number(row.balance) };
    });

    res.json({
      current_balance,
      monthly_snapshots,
      note: 'این مقدار بر اساس تراکنش‌های ثبت‌شده محاسبه شده است',
    });
  } catch (err) {
    console.error('[reports.networth]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function subscriptionTrackerEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const rows = stmts.recurringMonthly.all(userId);
    const subscriptions = rows.map((r) => ({
      id: r.id,
      title: r.title,
      amount: Number(r.amount),
      category: r.category_name,
      next_expected: r.next_expected,
    }));
    const total_monthly = subscriptions.reduce((s, r) => s + r.amount, 0);
    const count = subscriptions.length;
    let alert = null;
    if (count > 5) alert = `این ماه ${fa(count)} اشتراک پرداخت کرده‌اید`;
    else if (total_monthly > 2_000_000) alert = 'مجموع اشتراک‌های ماهانه شما بالاست';

    res.json({ subscriptions, total_monthly, count, alert });
  } catch (err) {
    console.error('[reports.subscriptions]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function scoreEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const month = parseMonth(req.query.month);
    if (!month) return res.status(400).json({ message: 'فرمت ماه نامعتبر است' });
    const result = calculateFinancialScore(userId, month);
    res.json(result);
  } catch (err) {
    console.error('[reports.score]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

const SQLITE_DOW_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

function computeLoggingStreak(userId) {
  const rows = stmts.distinctTxDates.all(userId);
  if (!rows.length) return 0;
  const dates = new Set(rows.map((r) => r.d));
  const d = new Date();
  let cur = d.toISOString().slice(0, 10);
  if (!dates.has(cur)) {
    d.setUTCDate(d.getUTCDate() - 1);
    cur = d.toISOString().slice(0, 10);
  }
  let streak = 0;
  while (dates.has(cur)) {
    streak += 1;
    d.setUTCDate(d.getUTCDate() - 1);
    cur = d.toISOString().slice(0, 10);
  }
  return streak;
}

function scoreHistoryEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    let months = Number(req.query.months);
    if (!Number.isFinite(months) || months <= 0) months = 6;
    months = Math.min(12, Math.max(1, Math.floor(months)));

    calculateFinancialScore(userId, currentMonth());

    const rows = stmts.scoreHistoryRows.all(userId, months).slice().reverse();
    const history = rows.map((r) => ({
      month: r.month,
      score: Number(r.score),
      label: scoreLabel(Number(r.score)).label,
    }));

    let best_month = null;
    let avg_score = 0;
    if (history.length) {
      avg_score = Math.round(history.reduce((s, h) => s + h.score, 0) / history.length);
      best_month = history.reduce((best, h) => (h.score > best.score ? h : best), history[0]);
      best_month = { month: best_month.month, score: best_month.score };
    }

    let trend = 'stable';
    if (history.length >= 2) {
      const last = history[history.length - 1].score;
      const prev = history[history.length - 2].score;
      if (last > prev + 2) trend = 'up';
      else if (last < prev - 2) trend = 'down';
    }

    res.json({ history, best_month, avg_score, trend });
  } catch (err) {
    console.error('[reports.scoreHistory]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function insightsEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    let monthsBack = Number(req.query.months);
    if (!Number.isFinite(monthsBack) || monthsBack <= 0) monthsBack = 3;
    monthsBack = Math.min(12, Math.max(1, Math.floor(monthsBack)));

    let startMonth = currentMonth();
    for (let i = 0; i < monthsBack - 1; i += 1) startMonth = prevMonth(startMonth);
    const rangeFrom = monthRange(startMonth).from;
    const curMonth = currentMonth();
    const { from: curFrom, to: curTo } = monthRange(curMonth);
    const prevM = prevMonth(curMonth);
    const { from: prevFrom, to: prevTo } = monthRange(prevM);
    const rangeTo = monthRange(curMonth).to;

    const insights = [];

    const dowRows = stmts.expenseByDow.all(userId, rangeFrom, rangeTo);
    if (dowRows.length) {
      const sorted = dowRows.slice().sort((a, b) => Number(b.total) - Number(a.total));
      const peak = sorted[0];
      const avg = dowRows.reduce((s, r) => s + Number(r.total), 0) / dowRows.length;
      const peakTotal = Number(peak.total);
      const excess = avg > 0 ? Math.round(((peakTotal - avg) / avg) * 100) : 0;
      const dayName = SQLITE_DOW_FA[Number(peak.dow)] || 'نامشخص';
      insights.push({
        type: 'peak_day',
        day: dayName,
        excess_percent: Math.max(0, excess),
        direction: excess > 20 ? 'warning' : 'neutral',
        message: `بیشترین خرج شما در ${dayName}‌هاست — ${fa(Math.max(0, excess))}٪ بیشتر از میانگین روزهای دیگر`,
      });
    }

    const curTopCat = db.prepare(`
      SELECT c.id, c.name, COALESCE(SUM(t.amount), 0) AS amount
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.type = 'expense' AND t.is_deleted = 0
         AND t.transaction_date >= ? AND t.transaction_date <= ?
       GROUP BY c.id
       ORDER BY amount DESC LIMIT 1
    `).get(userId, curFrom, curTo);
    if (curTopCat) {
      const prevRow = stmts.categoryExpenseInRange.get(
        userId, prevFrom, prevTo, curTopCat.id
      );
      const prevAmt = prevRow ? Number(prevRow.amount) : 0;
      const curAmt = Number(curTopCat.amount);
      const change = prevAmt > 0 ? Math.round(((curAmt - prevAmt) / prevAmt) * 100) : 0;
      insights.push({
        type: 'category_trend',
        category: curTopCat.name,
        change_percent: Math.abs(change),
        direction: change > 0 ? 'warning' : change < 0 ? 'good' : 'neutral',
        message: change > 0
          ? `این ماه ${fa(Math.abs(change))}٪ بیشتر از ماه قبل برای ${curTopCat.name} خرج کردید`
          : change < 0
            ? `این ماه ${fa(Math.abs(change))}٪ کمتر از ماه قبل برای ${curTopCat.name} خرج کردید`
            : `خرج ${curTopCat.name} نسبت به ماه قبل تقریباً ثابت مانده`,
      });
    }

    const income = Number(stmts.monthTotal.get(userId, 'income', curFrom, curTo).total);
    const expense = Number(stmts.monthTotal.get(userId, 'expense', curFrom, curTo).total);
    if (income > 0) {
      const rate = Math.round(((income - expense) / income) * 100);
      insights.push({
        type: 'savings_rate',
        rate,
        direction: rate >= 20 ? 'good' : rate >= 10 ? 'neutral' : 'warning',
        message: rate >= 20
          ? `نرخ پس‌انداز شما ${fa(rate)}٪ است — عالی!`
          : rate >= 0
            ? `نرخ پس‌انداز شما ${fa(rate)}٪ است`
            : `هزینه‌های این ماه از درآمد بیشتر شده — ${fa(Math.abs(rate))}٪`,
      });
    }

    const subs = stmts.recurringMonthly.all(userId);
    const subTotal = subs.reduce((s, r) => s + Number(r.amount), 0);
    if (subs.length) {
      insights.push({
        type: 'subscriptions',
        count: subs.length,
        total: subTotal,
        direction: subTotal > 1_000_000 ? 'warning' : 'neutral',
        message: `این ماه ${fa(subs.length)} اشتراک به مجموع ${faMoney(subTotal)} تومان پرداخت کردید`,
      });
    }

    const budgetRows = stmts.budgetsWithSpent.all(`${curMonth}-%`, userId, curMonth);
    if (budgetRows.length) {
      const exceeded = budgetRows.filter((r) => Number(r.spent) > Number(r.amount)).length;
      insights.push({
        type: 'budget_adherence',
        exceeded,
        total_budgets: budgetRows.length,
        direction: exceeded === 0 ? 'good' : exceeded >= 2 ? 'warning' : 'neutral',
        message: exceeded === 0
          ? 'همه دسته‌بندی‌های بودجه‌دار در محدوده هستند'
          : `${fa(exceeded)} دسته‌بندی از بودجه تعیین‌شده عبور کرده${exceeded > 1 ? '‌اند' : ' است'}`,
      });
    }

    const streak = computeLoggingStreak(userId);
    if (streak >= 3) {
      insights.push({
        type: 'logging_streak',
        days: streak,
        direction: 'good',
        message: `${fa(streak)} روز متوالی تراکنش ثبت کرده‌اید — آفرین!`,
      });
    }

    res.json({
      insights,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[reports.insights]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function exportCsvEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    let dateFrom = null;
    let dateTo = null;
    let filenameMonth = 'all';

    if (req.query.month) {
      const month = parseMonth(req.query.month);
      if (!month) return res.status(400).json({ message: 'فرمت ماه نامعتبر است' });
      const range = monthRange(month);
      dateFrom = range.from;
      dateTo = range.to;
      filenameMonth = month;
    } else {
      if (req.query.date_from) dateFrom = req.query.date_from;
      if (req.query.date_to) dateTo = req.query.date_to;
    }

    const rows = stmts.exportTx.all(
      userId,
      dateFrom, dateFrom,
      dateTo, dateTo
    );

    const csvRows = rows.map((t) => ({
      'نوع': t.type === 'income' ? 'درآمد' : 'هزینه',
      'عنوان': t.title,
      'مبلغ (تومان)': t.amount,
      'دسته‌بندی': t.category_name || '',
      'تاریخ (YYYY-MM-DD)': gregToJalaliStr(t.transaction_date.slice(0, 10)),
      'یادداشت': t.note || '',
      'تگ‌ها': t.tags || '',
      'تکراری': t.is_recurring ? 'بله' : 'خیر',
    }));

    const csv = Papa.unparse(csvRows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dakhlyar_transactions_${filenameMonth}.csv"`
    );
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('[reports.exportCsv]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function exportPdfEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const month = parseMonth(req.query.month);
    if (!month) return res.status(400).json({ message: 'فرمت ماه نامعتبر است' });

    const { from, to } = monthRange(month);
    const income = buildCategoryBreakdown(userId, 'income', from, to);
    const expense = buildCategoryBreakdown(userId, 'expense', from, to);
    const scoreData = calculateFinancialScore(userId, month);
    const dailyRows = stmts.dailyTotals.all(userId, from, to);
    const daily_totals = buildDailyTotals(from, to, dailyRows);
    const topTx = stmts.topTransactions.all(userId, from, to);

    if (!fs.existsSync(FONT_REG)) {
      return res.status(500).json({ message: 'فونت PDF یافت نشد' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dakhlyar_report_${month}.pdf"`
    );

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);
    doc.registerFont('Vazir', FONT_REG);
    doc.registerFont('VazirBold', FONT_BOLD);

    doc.font('VazirBold').fontSize(18).text('دخلیار — گزارش ماهانه', { align: 'right' });
    doc.font('Vazir').fontSize(12).text(monthFaLabel(month), { align: 'right' });
    doc.moveDown();

    doc.font('VazirBold').text('خلاصه', { align: 'right' });
    doc.font('Vazir').fontSize(11);
    doc.text(`درآمد: ${faMoney(income.total)} تومان`, { align: 'right' });
    doc.text(`هزینه: ${faMoney(expense.total)} تومان`, { align: 'right' });
    doc.text(`مانده: ${faMoney(income.total - expense.total)} تومان`, { align: 'right' });
    doc.text(`امتیاز مالی: ${fa(scoreData.score)} — ${scoreData.label}`, { align: 'right' });
    doc.moveDown();

    doc.font('VazirBold').text('هزینه به تفکیک دسته', { align: 'right' });
    doc.font('Vazir').fontSize(10);
    const maxExp = expense.by_category[0]?.amount || 1;
    let y = doc.y + 8;
    for (const cat of expense.by_category.slice(0, 8)) {
      const barW = Math.round((cat.amount / maxExp) * 300);
      doc.rect(40, y, barW, 10).fill(cat.category.color || '#9CA3AF');
      doc.fillColor('#000').text(
        `${cat.category.name}: ${faMoney(cat.amount)} (${fa(cat.percentage)}٪)`,
        350, y - 2, { align: 'right', width: 180 }
      );
      y += 18;
    }
    doc.y = y + 10;

    doc.font('VazirBold').fontSize(12).text('۵ تراکنش پرهزینه', { align: 'right' });
    doc.font('Vazir').fontSize(10);
    for (const t of topTx) {
      doc.text(
        `${t.title} — ${faMoney(t.amount)} — ${gregToJalaliStr(t.transaction_date)}`,
        { align: 'right' }
      );
    }
    doc.moveDown();

    doc.font('VazirBold').text('امتیاز مالی — جزئیات', { align: 'right' });
    doc.font('Vazir').fontSize(10);
    for (const [key, comp] of Object.entries(scoreData.breakdown)) {
      doc.text(`${comp.label}: ${fa(comp.score)}/${fa(comp.max)}`, { align: 'right' });
    }

    doc.moveDown(2);
    doc.font('Vazir').fontSize(9).fillColor('#666');
    doc.text(
      `تولید شده در ${fa(new Date().toISOString().slice(0, 10))} — دخلیار — مدیریت مالی شخصی`,
      { align: 'center' }
    );

    doc.end();
  } catch (err) {
    console.error('[reports.exportPdf]', err);
    if (!res.headersSent) res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  monthlyReportEndpoint,
  comparisonReportEndpoint,
  weeklyPatternEndpoint,
  cashFlowForecastEndpoint,
  netWorthSnapshotEndpoint,
  subscriptionTrackerEndpoint,
  scoreEndpoint,
  scoreHistoryEndpoint,
  insightsEndpoint,
  exportCsvEndpoint,
  exportPdfEndpoint,
};
