'use strict';

const db = require('../db/appDb');
const messages = require('./messagesController');

const stmts = {
  listGoals: db.prepare(`
    SELECT id, title, target_amount, saved_amount, icon, color, deadline,
           is_completed, created_at, updated_at
      FROM savings_goals
     WHERE user_id = ?
       AND (? = 1 OR is_completed = 0)
     ORDER BY is_completed ASC, created_at DESC
  `),
  getGoal: db.prepare(`
    SELECT id, user_id, title, target_amount, saved_amount, icon, color,
           deadline, is_completed, created_at, updated_at
      FROM savings_goals
     WHERE id = ? AND user_id = ?
     LIMIT 1
  `),
  insertGoal: db.prepare(`
    INSERT INTO savings_goals
      (user_id, title, target_amount, saved_amount, icon, color, deadline, is_completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateGoal: db.prepare(`
    UPDATE savings_goals
       SET title = ?, target_amount = ?, icon = ?, color = ?, deadline = ?,
           is_completed = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?
  `),
  patchFields: db.prepare(`
    UPDATE savings_goals
       SET updated_at = datetime('now')
     WHERE id = ? AND user_id = ?
  `),
  addSaved: db.prepare(`
    UPDATE savings_goals
       SET saved_amount = saved_amount + ?,
           is_completed = CASE WHEN saved_amount + ? >= target_amount THEN 1 ELSE is_completed END,
           updated_at = datetime('now')
     WHERE id = ? AND user_id = ?
  `),
  subtractSaved: db.prepare(`
    UPDATE savings_goals
       SET saved_amount = saved_amount - ?,
           is_completed = CASE WHEN saved_amount - ? < target_amount THEN 0 ELSE is_completed END,
           updated_at = datetime('now')
     WHERE id = ? AND user_id = ?
  `),
  setCompleted: db.prepare(`
    UPDATE savings_goals SET is_completed = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?
  `),
  deleteGoal: db.prepare('DELETE FROM savings_goals WHERE id = ? AND user_id = ?'),
  deleteContributions: db.prepare('DELETE FROM goal_contributions WHERE goal_id = ? AND user_id = ?'),
  insertContribution: db.prepare(`
    INSERT INTO goal_contributions (goal_id, user_id, amount, note)
    VALUES (?, ?, ?, ?)
  `),
  listContributions: db.prepare(`
    SELECT id, amount, note, contributed_at
      FROM goal_contributions
     WHERE goal_id = ? AND user_id = ?
     ORDER BY contributed_at DESC, id DESC
  `),
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return null;
  return str.trim();
}

function isFutureDate(dateStr) {
  return dateStr > todayIso();
}

function daysRemaining(deadline) {
  if (!deadline) return null;
  const today = new Date(todayIso() + 'T00:00:00Z');
  const dl = new Date(deadline + 'T00:00:00Z');
  const diff = Math.ceil((dl - today) / 86400000);
  return diff;
}

function monthsUntilDeadline(deadline) {
  if (!deadline) return null;
  const rem = daysRemaining(deadline);
  if (rem == null || rem <= 0) return null;
  const today = new Date(todayIso() + 'T00:00:00Z');
  const dl = new Date(deadline + 'T00:00:00Z');
  let months = (dl.getUTCFullYear() - today.getUTCFullYear()) * 12
    + (dl.getUTCMonth() - today.getUTCMonth());
  if (dl.getUTCDate() < today.getUTCDate()) months -= 1;
  return Math.max(1, months);
}

function enrichGoal(row) {
  const target = Number(row.target_amount);
  const saved = Number(row.saved_amount);
  const remaining = Math.max(0, target - saved);
  const percentage = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const days = row.deadline ? daysRemaining(row.deadline) : null;
  let monthly_needed = null;
  if (row.deadline && days != null && days > 0 && remaining > 0) {
    const months = monthsUntilDeadline(row.deadline);
    if (months) monthly_needed = Math.ceil(remaining / months);
  }
  return {
    id: row.id,
    title: row.title,
    icon: row.icon || '🎯',
    color: row.color || '#1A5C3A',
    target_amount: target,
    saved_amount: saved,
    remaining,
    percentage,
    deadline: row.deadline || null,
    days_remaining: days,
    monthly_needed,
    is_completed: !!row.is_completed,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function shapeGoalShort(row) {
  const g = enrichGoal(row);
  return {
    id: g.id,
    saved_amount: g.saved_amount,
    percentage: g.percentage,
    is_completed: g.is_completed,
  };
}

function listGoalsEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const includeCompleted = String(req.query.include_completed || 'false').toLowerCase() === 'true';
    const rows = stmts.listGoals.all(userId, includeCompleted ? 1 : 0);
    const goals = rows.map(enrichGoal);
    const total_saved = goals.reduce((s, g) => s + g.saved_amount, 0);
    const total_target = goals.reduce((s, g) => s + g.target_amount, 0);
    res.json({ goals, total_saved, total_target });
  } catch (err) {
    console.error('[goals.list]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function createGoalEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const title = String(req.body.title || '').trim();
    const target_amount = Number(req.body.target_amount);
    const icon = String(req.body.icon || '🎯').trim() || '🎯';
    const color = String(req.body.color || '#1A5C3A').trim() || '#1A5C3A';
    const deadlineRaw = req.body.deadline;
    const initial_amount = Number(req.body.initial_amount || 0);

    if (!title || title.length > 60) {
      return res.status(400).json({ message: 'عنوان هدف باید بین ۱ تا ۶۰ کاراکتر باشد' });
    }
    if (!Number.isInteger(target_amount) || target_amount <= 0) {
      return res.status(422).json({ message: 'مبلغ هدف باید بزرگ‌تر از صفر باشد' });
    }

    let deadline = null;
    if (deadlineRaw != null && String(deadlineRaw).trim()) {
      deadline = parseDate(String(deadlineRaw));
      if (!deadline) return res.status(400).json({ message: 'فرمت تاریخ نامعتبر است' });
      if (!isFutureDate(deadline)) {
        return res.status(400).json({ message: 'تاریخ هدف باید در آینده باشد' });
      }
    }

    let saved = 0;
    if (Number.isInteger(initial_amount) && initial_amount > 0) {
      saved = Math.min(initial_amount, target_amount);
    }
    const is_completed = saved >= target_amount ? 1 : 0;

    const info = stmts.insertGoal.run(
      userId, title, target_amount, saved, icon, color, deadline, is_completed
    );
    const goalId = Number(info.lastInsertRowid);

    if (saved > 0) {
      stmts.insertContribution.run(goalId, userId, saved, 'مبلغ اولیه');
    }

    const row = stmts.getGoal.get(goalId, userId);
    res.status(201).json({ success: true, goal: enrichGoal(row) });
  } catch (err) {
    console.error('[goals.create]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function patchGoalEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }

    const existing = stmts.getGoal.get(id, userId);
    if (!existing) return res.status(404).json({ message: 'هدف یافت نشد' });

    let title = existing.title;
    let target_amount = Number(existing.target_amount);
    let icon = existing.icon || '🎯';
    let color = existing.color || '#1A5C3A';
    let deadline = existing.deadline;

    if (req.body.title != null) {
      title = String(req.body.title).trim();
      if (!title || title.length > 60) {
        return res.status(400).json({ message: 'عنوان هدف باید بین ۱ تا ۶۰ کاراکتر باشد' });
      }
    }
    if (req.body.target_amount != null) {
      target_amount = Number(req.body.target_amount);
      if (!Number.isInteger(target_amount) || target_amount <= 0) {
        return res.status(422).json({ message: 'مبلغ هدف باید بزرگ‌تر از صفر باشد' });
      }
    }
    if (req.body.icon != null) icon = String(req.body.icon).trim() || '🎯';
    if (req.body.color != null) color = String(req.body.color).trim() || '#1A5C3A';
    if (req.body.deadline !== undefined) {
      if (req.body.deadline == null || req.body.deadline === '') {
        deadline = null;
      } else {
        deadline = parseDate(String(req.body.deadline));
        if (!deadline) return res.status(400).json({ message: 'فرمت تاریخ نامعتبر است' });
        if (!isFutureDate(deadline) && !existing.is_completed) {
          return res.status(400).json({ message: 'تاریخ هدف باید در آینده باشد' });
        }
      }
    }

    const saved = Number(existing.saved_amount);
    const is_completed = saved >= target_amount ? 1 : 0;

    stmts.updateGoal.run(
      title, target_amount, icon, color, deadline, is_completed, id, userId
    );
    const row = stmts.getGoal.get(id, userId);
    res.json({ success: true, goal: enrichGoal(row) });
  } catch (err) {
    console.error('[goals.patch]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function deleteGoalEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    const existing = stmts.getGoal.get(id, userId);
    if (!existing) return res.status(404).json({ message: 'هدف یافت نشد' });

    const tx = db.transaction((goalId, uid) => {
      stmts.deleteContributions.run(goalId, uid);
      stmts.deleteGoal.run(goalId, uid);
    });
    tx(id, userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[goals.delete]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function notifyGoalCompleted(userId, goalTitle, goalId) {
  try {
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    messages.insertMessage({
      userId,
      type: 'admin_direct',
      title: 'هدف تکمیل شد 🎉',
      body: `هدف «${goalTitle}» با موفقیت به پایان رسید!`,
      relatedId: goalId,
      expiresAt,
    });
  } catch (err) {
    console.error('[goals.completeNotify]', err && err.message);
  }
}

function contributeEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const id = Number(req.params.id);
    const amount = Number(req.body.amount);
    const note = req.body.note != null ? String(req.body.note).trim().slice(0, 200) : null;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: 'مبلغ باید بزرگ‌تر از صفر باشد' });
    }

    const existing = stmts.getGoal.get(id, userId);
    if (!existing) return res.status(403).json({ message: 'دسترسی غیرمجاز' });

    const wasCompleted = !!existing.is_completed;
    stmts.insertContribution.run(id, userId, amount, note || null);
    stmts.addSaved.run(amount, amount, id, userId);

    const row = stmts.getGoal.get(id, userId);
    if (!wasCompleted && row.is_completed) {
      notifyGoalCompleted(userId, row.title, id);
    }

    res.json({ success: true, goal: shapeGoalShort(row) });
  } catch (err) {
    console.error('[goals.contribute]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function withdrawEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const id = Number(req.params.id);
    const amount = Number(req.body.amount);
    const note = req.body.note != null ? String(req.body.note).trim().slice(0, 200) : null;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: 'مبلغ باید بزرگ‌تر از صفر باشد' });
    }

    const existing = stmts.getGoal.get(id, userId);
    if (!existing) return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    if (Number(existing.saved_amount) < amount) {
      return res.status(400).json({ message: 'موجودی کافی برای برداشت وجود ندارد' });
    }

    stmts.insertContribution.run(id, userId, -amount, note || null);
    stmts.subtractSaved.run(amount, amount, id, userId);

    const row = stmts.getGoal.get(id, userId);
    res.json({ success: true, goal: shapeGoalShort(row) });
  } catch (err) {
    console.error('[goals.withdraw]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function historyEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    const existing = stmts.getGoal.get(id, userId);
    if (!existing) return res.status(404).json({ message: 'هدف یافت نشد' });

    const contributions = stmts.listContributions.all(id, userId);
    res.json({ contributions });
  } catch (err) {
    console.error('[goals.history]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listGoalsEndpoint,
  createGoalEndpoint,
  patchGoalEndpoint,
  deleteGoalEndpoint,
  contributeEndpoint,
  withdrawEndpoint,
  historyEndpoint,
};
