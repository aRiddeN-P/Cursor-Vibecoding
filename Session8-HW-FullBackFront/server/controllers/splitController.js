'use strict';

const crypto = require('crypto');
const db = require('../db/appDb');
const {
  calculateBalances,
  calculateMinimumSettlements,
  equalShares,
} = require('../utils/splitHelper');

const stmts = {
  userMobile: db.prepare('SELECT id, mobile, first_name, last_name FROM users WHERE id = ? LIMIT 1'),
  userByMobile: db.prepare('SELECT id, mobile, first_name, last_name FROM users WHERE mobile = ? LIMIT 1'),

  listGroupsForUser: db.prepare(`
    SELECT DISTINCT g.*
      FROM split_groups g
      LEFT JOIN split_members m ON m.group_id = g.id
     WHERE g.is_active = 1
       AND (g.created_by = ? OR m.user_id = ?)
     ORDER BY g.updated_at DESC, g.id DESC
  `),

  getGroup: db.prepare(`
    SELECT * FROM split_groups WHERE id = ? AND is_active = 1 LIMIT 1
  `),
  getGroupByToken: db.prepare(`
    SELECT * FROM split_groups WHERE invite_token = ? AND is_active = 1 LIMIT 1
  `),

  insertGroup: db.prepare(`
    INSERT INTO split_groups (name, description, created_by, invite_token)
    VALUES (?, ?, ?, ?)
  `),
  touchGroup: db.prepare(`
    UPDATE split_groups SET updated_at = datetime('now') WHERE id = ?
  `),

  listMembers: db.prepare(`
    SELECT * FROM split_members WHERE group_id = ? ORDER BY joined_at ASC, id ASC
  `),
  getMember: db.prepare(`
    SELECT * FROM split_members WHERE id = ? AND group_id = ? LIMIT 1
  `),
  memberByUser: db.prepare(`
    SELECT * FROM split_members WHERE group_id = ? AND user_id = ? LIMIT 1
  `),
  memberByMobile: db.prepare(`
    SELECT * FROM split_members WHERE group_id = ? AND mobile = ? LIMIT 1
  `),
  insertMember: db.prepare(`
    INSERT INTO split_members (group_id, user_id, mobile, display_name, is_registered)
    VALUES (?, ?, ?, ?, ?)
  `),
  deleteMember: db.prepare('DELETE FROM split_members WHERE id = ? AND group_id = ?'),
  linkMembersByMobile: db.prepare(`
    UPDATE split_members
       SET user_id = ?, is_registered = 1
     WHERE mobile = ? AND (user_id IS NULL OR user_id = ?)
  `),

  countMembers: db.prepare('SELECT COUNT(*) AS c FROM split_members WHERE group_id = ?'),

  listExpenses: db.prepare(`
    SELECT e.*,
           c.id AS cat_id, c.name AS cat_name, c.icon AS cat_icon
      FROM split_expenses e
      LEFT JOIN categories c ON c.id = e.category_id
     WHERE e.group_id = ? AND e.is_deleted = 0
     ORDER BY e.expense_date DESC, e.id DESC
  `),
  getExpense: db.prepare(`
    SELECT * FROM split_expenses
     WHERE id = ? AND group_id = ? AND is_deleted = 0 LIMIT 1
  `),
  insertExpense: db.prepare(`
    INSERT INTO split_expenses
      (group_id, paid_by_member_id, title, amount, category_id, expense_date, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updateExpense: db.prepare(`
    UPDATE split_expenses
       SET title = ?, amount = ?, paid_by_member_id = ?, expense_date = ?, note = ?
     WHERE id = ? AND group_id = ? AND is_deleted = 0
  `),
  softDeleteExpense: db.prepare(`
    UPDATE split_expenses SET is_deleted = 1 WHERE id = ? AND group_id = ?
  `),

  listSharesForExpense: db.prepare(`
    SELECT * FROM split_expense_shares WHERE expense_id = ? ORDER BY id ASC
  `),
  listSharesForGroup: db.prepare(`
    SELECT s.* FROM split_expense_shares s
      JOIN split_expenses e ON e.id = s.expense_id
     WHERE e.group_id = ? AND e.is_deleted = 0
  `),
  deleteSharesForExpense: db.prepare('DELETE FROM split_expense_shares WHERE expense_id = ?'),
  insertShare: db.prepare(`
    INSERT INTO split_expense_shares (expense_id, member_id, share_amount)
    VALUES (?, ?, ?)
  `),
  unsettledSharesForMember: db.prepare(`
    SELECT COUNT(*) AS c FROM split_expense_shares s
      JOIN split_expenses e ON e.id = s.expense_id
     WHERE s.member_id = ? AND e.group_id = ? AND e.is_deleted = 0 AND s.is_settled = 0
  `),
  unsettledSharesOrdered: db.prepare(`
    SELECT s.* FROM split_expense_shares s
      JOIN split_expenses e ON e.id = s.expense_id
     WHERE s.member_id = ? AND e.group_id = ? AND e.is_deleted = 0 AND s.is_settled = 0
     ORDER BY e.expense_date ASC, s.id ASC
  `),
  markShareSettled: db.prepare(`
    UPDATE split_expense_shares
       SET is_settled = 1, settled_at = datetime('now'), transaction_id = ?
     WHERE id = ?
  `),

  listSettlements: db.prepare(`
    SELECT * FROM split_settlements WHERE group_id = ? ORDER BY settled_at DESC, id DESC
  `),
  insertSettlement: db.prepare(`
    INSERT INTO split_settlements (group_id, from_member_id, to_member_id, amount, note, transaction_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  updateSettlementTx: db.prepare(`
    UPDATE split_settlements SET transaction_id = ? WHERE id = ?
  `),

  sumExpenses: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
      FROM split_expenses WHERE group_id = ? AND is_deleted = 0
  `),

  settlementCategory: db.prepare(`
    SELECT id FROM categories
     WHERE user_id = ? AND lower(name) = lower('تسویه حساب') AND is_active = 1
     LIMIT 1
  `),
  insertCategory: db.prepare(`
    INSERT INTO categories (name, icon, color, type, is_default, user_id, is_active)
    VALUES ('تسویه حساب', '🤝', '#6B7280', 'expense', 0, ?, 1)
  `),
  insertTx: db.prepare(`
    INSERT INTO transactions (
      user_id, type, amount, currency,
      amount_original, currency_original, exchange_rate,
      category_id, title, note, tags,
      transaction_date, transaction_time,
      is_recurring, recurring_interval
    ) VALUES (
      ?, 'expense', ?, 'IRR',
      NULL, NULL, NULL,
      ?, ?, ?, '',
      ?, NULL,
      0, NULL
    )
  `),
};

function fa(n) {
  const s = String(n);
  return s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}

function normalizeMobile(m) {
  if (m == null || m === '') return null;
  const s = String(m).replace(/\D/g, '');
  if (s.length === 10 && s.startsWith('9')) return `0${s}`;
  if (s.length === 11 && s.startsWith('09')) return s;
  return null;
}

function generateToken() {
  for (let i = 0; i < 5; i += 1) {
    const t = crypto.randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    if (t.length >= 10) return t.padEnd(12, '0').slice(0, 12);
  }
  return crypto.randomBytes(6).toString('hex');
}

function shareUrl(req, token, mobile) {
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  let url = `${base}/split-view.html?token=${encodeURIComponent(token)}`;
  if (mobile) url += `&member=${encodeURIComponent(mobile)}`;
  return url;
}

function displayNameFromUser(u) {
  const parts = [u.first_name, u.last_name].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return u.mobile || 'کاربر';
}

function linkMembersForUser(userId) {
  const user = stmts.userMobile.get(userId);
  if (!user || !user.mobile) return;
  stmts.linkMembersByMobile.run(userId, user.mobile, userId);
}

function assertMember(groupId, userId) {
  linkMembersForUser(userId);
  const m = stmts.memberByUser.get(groupId, userId);
  if (!m) return null;
  return m;
}

function loadGroupData(groupId) {
  const members = stmts.listMembers.all(groupId);
  const expensesRaw = stmts.listExpenses.all(groupId);
  const sharesAll = stmts.listSharesForGroup.all(groupId);
  const sharesByExp = new Map();
  for (const sh of sharesAll) {
    if (!sharesByExp.has(sh.expense_id)) sharesByExp.set(sh.expense_id, []);
    sharesByExp.get(sh.expense_id).push(sh);
  }
  const expenses = expensesRaw.map((e) => ({
    ...e,
    shares: sharesByExp.get(e.id) || [],
  }));
  const settlements = stmts.listSettlements.all(groupId);
  const balances = calculateBalances(members, expenses, settlements);
  return { members, expenses, settlements, balances };
}

function memberShape(m, balances) {
  return {
    id: m.id,
    display_name: m.display_name,
    mobile: m.mobile,
    is_registered: Boolean(m.is_registered),
    user_id: m.user_id,
    balance: balances[m.id] || 0,
  };
}

function expenseShape(e, membersById, myMemberId) {
  const paidBy = membersById.get(e.paid_by_member_id);
  const shares = (e.shares || []).map((sh) => {
    const mem = membersById.get(sh.member_id);
    return {
      member_id: sh.member_id,
      display_name: mem ? mem.display_name : '—',
      share_amount: sh.share_amount,
      is_settled: Boolean(sh.is_settled),
    };
  });
  let myShare = null;
  if (myMemberId) {
    const mine = shares.find((s) => s.member_id === myMemberId);
    if (mine) myShare = { share_amount: mine.share_amount, is_settled: mine.is_settled };
  }
  return {
    id: e.id,
    title: e.title,
    amount: e.amount,
    expense_date: e.expense_date,
    note: e.note,
    paid_by: paidBy ? { id: paidBy.id, display_name: paidBy.display_name } : null,
    category: e.cat_id ? { id: e.cat_id, name: e.cat_name, icon: e.cat_icon } : null,
    shares,
    my_share: myShare,
  };
}

function settlementShape(s, membersById) {
  const fromId = s.from_member_id != null ? s.from_member_id : s.from;
  const toId = s.to_member_id != null ? s.to_member_id : s.to;
  const from = membersById.get(fromId);
  const to = membersById.get(toId);
  return {
    from: from ? { id: from.id, display_name: from.display_name } : { id: fromId, display_name: '—' },
    to: to ? { id: to.id, display_name: to.display_name } : { id: toId, display_name: '—' },
    amount: s.amount,
    settled_at: s.settled_at,
    transaction_id: s.transaction_id,
    note: s.note,
  };
}

function findOrCreateSettlementCategory(userId) {
  let row = stmts.settlementCategory.get(userId);
  if (row) return row.id;
  const info = stmts.insertCategory.run(userId);
  return Number(info.lastInsertRowid);
}

function markSharesSettled(fromMemberId, groupId, amount, transactionId) {
  let remaining = Math.round(amount);
  const rows = stmts.unsettledSharesOrdered.all(fromMemberId, groupId);
  for (const sh of rows) {
    if (remaining <= 0) break;
    if (sh.share_amount <= remaining) {
      stmts.markShareSettled.run(transactionId || null, sh.id);
      remaining -= sh.share_amount;
    }
  }
}

function canEditExpense(group, expense, userId, userMember) {
  if (group.created_by === userId) return true;
  if (!userMember) return false;
  return expense.paid_by_member_id === userMember.id;
}

function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

// ─── Endpoints ─────────────────────────────────────────────────────────────

function listGroupsEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    linkMembersForUser(userId);
    const rows = stmts.listGroupsForUser.all(userId, userId);
    const groups = rows.map((g) => {
      const { members, expenses, settlements, balances } = loadGroupData(g.id);
      const myMember = members.find((m) => m.user_id === userId);
      const total = expenses.reduce((s, e) => s + e.amount, 0);
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        invite_token: g.invite_token,
        member_count: members.length,
        total_expenses: total,
        my_balance: myMember ? (balances[myMember.id] || 0) : 0,
        created_by_me: g.created_by === userId,
        created_at: g.created_at,
      };
    });
    return res.json({ groups });
  } catch (err) {
    console.error('[split.listGroups]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function createGroupEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const body = req.body || {};
    const name = String(body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'نام گروه الزامی است' });
    if (name.length > 60) {
      return res.status(422).json({ message: 'نام گروه نمی‌تواند بیش از ۶۰ کاراکتر باشد' });
    }
    const description = body.description ? String(body.description).trim().slice(0, 500) : null;
    const membersInput = Array.isArray(body.members) ? body.members : [];

    let token = generateToken();
    let groupId;
    const user = stmts.userMobile.get(userId);

    const tx = db.transaction(() => {
      let info = stmts.insertGroup.run(name, description, userId, token);
      groupId = Number(info.lastInsertRowid);
      const creatorName = user ? displayNameFromUser(user) : 'من';
      stmts.insertMember.run(groupId, userId, user?.mobile || null, creatorName, 1);

      for (const raw of membersInput) {
        const display_name = String(raw.display_name || '').trim();
        if (!display_name) continue;
        const mobile = normalizeMobile(raw.mobile);
        if (mobile) {
          const existing = stmts.memberByMobile.get(groupId, mobile);
          if (existing) continue;
        }
        const regUser = mobile ? stmts.userByMobile.get(mobile) : null;
        if (regUser) {
          const ex = stmts.memberByUser.get(groupId, regUser.id);
          if (ex) continue;
          stmts.insertMember.run(
            groupId, regUser.id, mobile,
            display_name || displayNameFromUser(regUser), 1
          );
        } else {
          stmts.insertMember.run(groupId, null, mobile, display_name, 0);
        }
      }
    });
    tx();

    const group = stmts.getGroup.get(groupId);
    return res.status(201).json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        invite_token: group.invite_token,
        share_url: shareUrl(req, group.invite_token),
      },
    });
  } catch (err) {
    console.error('[split.createGroup]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function getGroupEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const groupId = toInt(req.params.id);
    if (!Number.isFinite(groupId)) return res.status(400).json({ message: 'شناسه نامعتبر' });

    const group = stmts.getGroup.get(groupId);
    if (!group) return res.status(404).json({ message: 'گروه یافت نشد' });

    const myMember = assertMember(groupId, userId);
    if (!myMember) return res.status(403).json({ message: 'شما عضو این گروه نیستید' });

    const { members, expenses, settlements, balances } = loadGroupData(groupId);
    const membersById = new Map(members.map((m) => [m.id, m]));

    const suggestedRaw = calculateMinimumSettlements(balances);
    const suggested = suggestedRaw.map((s) => settlementShape(s, membersById));

    const completed = settlements.map((s) => settlementShape(s, membersById));

    const summary = {
      total_expenses: expenses.reduce((s, e) => s + e.amount, 0),
      my_paid: 0,
      my_share: 0,
      my_balance: balances[myMember.id] || 0,
    };
    for (const e of expenses) {
      if (e.paid_by_member_id === myMember.id) summary.my_paid += e.amount;
      const sh = (e.shares || []).find((x) => x.member_id === myMember.id);
      if (sh) summary.my_share += sh.share_amount;
    }

    return res.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        invite_token: group.invite_token,
        share_url: shareUrl(req, group.invite_token),
        created_at: group.created_at,
        created_by: group.created_by,
      },
      members: members.map((m) => memberShape(m, balances)),
      expenses: expenses.map((e) => expenseShape(e, membersById, myMember.id)),
      settlements: { suggested, completed },
      summary,
    });
  } catch (err) {
    console.error('[split.getGroup]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function addMemberEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const groupId = toInt(req.params.id);
    const group = stmts.getGroup.get(groupId);
    if (!group) return res.status(404).json({ message: 'گروه یافت نشد' });
    if (group.created_by !== userId) {
      return res.status(403).json({ message: 'فقط سازنده گروه می‌تواند عضو اضافه کند' });
    }

    const body = req.body || {};
    const display_name = String(body.display_name || '').trim();
    if (!display_name) return res.status(400).json({ message: 'نام نمایشی الزامی است' });

    const mobile = normalizeMobile(body.mobile);
    const explicitUserId = body.user_id != null ? toInt(body.user_id) : null;

    if (mobile) {
      const dup = stmts.memberByMobile.get(groupId, mobile);
      if (dup) return res.status(409).json({ message: 'این شماره موبایل قبلاً در گروه است' });
    }

    let regUser = null;
    if (explicitUserId && Number.isFinite(explicitUserId)) {
      regUser = stmts.userMobile.get(explicitUserId);
    } else if (mobile) {
      regUser = stmts.userByMobile.get(mobile);
    }

    if (regUser) {
      const ex = stmts.memberByUser.get(groupId, regUser.id);
      if (ex) return res.status(409).json({ message: 'این کاربر قبلاً در گروه است' });
    }

    const info = stmts.insertMember.run(
      groupId,
      regUser ? regUser.id : null,
      mobile || (regUser ? regUser.mobile : null),
      display_name,
      regUser ? 1 : 0
    );
    stmts.touchGroup.run(groupId);

    return res.json({
      success: true,
      member: {
        id: Number(info.lastInsertRowid),
        display_name,
        is_registered: Boolean(regUser),
      },
    });
  } catch (err) {
    console.error('[split.addMember]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function removeMemberEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const groupId = toInt(req.params.id);
    const memberId = toInt(req.params.memberId);
    const group = stmts.getGroup.get(groupId);
    if (!group) return res.status(404).json({ message: 'گروه یافت نشد' });
    if (group.created_by !== userId) {
      return res.status(403).json({ message: 'فقط سازنده گروه می‌تواند عضو حذف کند' });
    }

    const member = stmts.getMember.get(memberId, groupId);
    if (!member) return res.status(404).json({ message: 'عضو یافت نشد' });

    const unsettled = stmts.unsettledSharesForMember.get(memberId, groupId);
    if (Number(unsettled.c) > 0) {
      return res.status(400).json({ message: 'این عضو هنوز بدهی تسویه‌نشده دارد' });
    }

    stmts.deleteMember.run(memberId, groupId);
    stmts.touchGroup.run(groupId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[split.removeMember]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function addExpenseEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const groupId = toInt(req.params.id);
    const group = stmts.getGroup.get(groupId);
    if (!group) return res.status(404).json({ message: 'گروه یافت نشد' });

    const myMember = assertMember(groupId, userId);
    if (!myMember) return res.status(403).json({ message: 'شما عضو این گروه نیستید' });

    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'عنوان الزامی است' });
    if (title.length > 60) return res.status(422).json({ message: 'عنوان نمی‌تواند بیش از ۶۰ کاراکتر باشد' });

    const amount = toInt(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'مبلغ باید بزرگ‌تر از صفر باشد' });
    }

    const paidBy = toInt(body.paid_by_member_id);
    const paidMember = stmts.getMember.get(paidBy, groupId);
    if (!paidMember) return res.status(400).json({ message: 'پرداخت‌کننده نامعتبر است' });

    const expenseDate = parseDate(body.expense_date);
    if (!expenseDate) return res.status(400).json({ message: 'تاریخ نامعتبر است' });

    const splitType = body.split_type === 'custom' ? 'custom' : 'equal';
    const categoryId = body.category_id != null ? toInt(body.category_id) : null;
    const note = body.note ? String(body.note).trim().slice(0, 500) : null;

    const members = stmts.listMembers.all(groupId);
    let shareRows;

    if (splitType === 'custom') {
      const shares = Array.isArray(body.shares) ? body.shares : [];
      if (!shares.length) return res.status(400).json({ message: 'سهم‌ها الزامی است' });
      shareRows = [];
      let sum = 0;
      for (const sh of shares) {
        const mid = toInt(sh.member_id);
        const amt = toInt(sh.share_amount);
        if (!stmts.getMember.get(mid, groupId)) {
          return res.status(400).json({ message: 'عضو نامعتبر در سهم‌ها' });
        }
        if (!Number.isFinite(amt) || amt < 0) {
          return res.status(400).json({ message: 'مبلغ سهم نامعتبر است' });
        }
        shareRows.push({ member_id: mid, share_amount: amt });
        sum += amt;
      }
      if (sum !== amount) {
        return res.status(400).json({ message: 'مجموع سهم‌ها باید برابر با مبلغ کل باشد' });
      }
    } else {
      const ids = members.map((m) => m.id);
      shareRows = equalShares(ids, amount, paidBy);
    }

    let expenseId;
    const tx = db.transaction(() => {
      const info = stmts.insertExpense.run(
        groupId, paidBy, title, amount,
        Number.isFinite(categoryId) ? categoryId : null,
        expenseDate, note
      );
      expenseId = Number(info.lastInsertRowid);
      for (const sh of shareRows) {
        stmts.insertShare.run(expenseId, sh.member_id, sh.share_amount);
      }
      stmts.touchGroup.run(groupId);
    });
    tx();

    const sharesOut = shareRows.map((sh) => {
      const mem = members.find((m) => m.id === sh.member_id);
      return {
        member_id: sh.member_id,
        display_name: mem ? mem.display_name : '—',
        share_amount: sh.share_amount,
      };
    });

    return res.status(201).json({
      success: true,
      expense: { id: expenseId, title, amount, shares: sharesOut },
    });
  } catch (err) {
    console.error('[split.addExpense]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function patchExpenseEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const groupId = toInt(req.params.id);
    const expenseId = toInt(req.params.expenseId);
    const group = stmts.getGroup.get(groupId);
    if (!group) return res.status(404).json({ message: 'گروه یافت نشد' });

    const myMember = assertMember(groupId, userId);
    if (!myMember) return res.status(403).json({ message: 'شما عضو این گروه نیستید' });

    const expense = stmts.getExpense.get(expenseId, groupId);
    if (!expense) return res.status(404).json({ message: 'هزینه یافت نشد' });
    if (!canEditExpense(group, expense, userId, myMember)) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }

    const body = req.body || {};
    const title = body.title != null ? String(body.title).trim() : expense.title;
    const amount = body.amount != null ? toInt(body.amount) : expense.amount;
    const paidBy = body.paid_by_member_id != null ? toInt(body.paid_by_member_id) : expense.paid_by_member_id;
    const expenseDate = body.expense_date != null ? parseDate(body.expense_date) : expense.expense_date;
    const note = body.note != null ? String(body.note).trim().slice(0, 500) : expense.note;

    if (!title || amount <= 0 || !expenseDate) {
      return res.status(400).json({ message: 'داده‌های نامعتبر' });
    }
    if (!stmts.getMember.get(paidBy, groupId)) {
      return res.status(400).json({ message: 'پرداخت‌کننده نامعتبر است' });
    }

    const amountChanged = amount !== expense.amount;

    const tx = db.transaction(() => {
      stmts.updateExpense.run(title, amount, paidBy, expenseDate, note, expenseId, groupId);
      if (amountChanged) {
        const members = stmts.listMembers.all(groupId);
        const shareRows = equalShares(members.map((m) => m.id), amount, paidBy);
        stmts.deleteSharesForExpense.run(expenseId);
        for (const sh of shareRows) {
          stmts.insertShare.run(expenseId, sh.member_id, sh.share_amount);
        }
      }
      stmts.touchGroup.run(groupId);
    });
    tx();

    return res.json({ success: true });
  } catch (err) {
    console.error('[split.patchExpense]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function deleteExpenseEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const groupId = toInt(req.params.id);
    const expenseId = toInt(req.params.expenseId);
    const group = stmts.getGroup.get(groupId);
    if (!group) return res.status(404).json({ message: 'گروه یافت نشد' });

    const myMember = assertMember(groupId, userId);
    if (!myMember) return res.status(403).json({ message: 'شما عضو این گروه نیستید' });

    const expense = stmts.getExpense.get(expenseId, groupId);
    if (!expense) return res.status(404).json({ message: 'هزینه یافت نشد' });
    if (!canEditExpense(group, expense, userId, myMember)) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }

    stmts.softDeleteExpense.run(expenseId, groupId);
    stmts.touchGroup.run(groupId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[split.deleteExpense]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function settleEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const groupId = toInt(req.params.id);
    const group = stmts.getGroup.get(groupId);
    if (!group) return res.status(404).json({ message: 'گروه یافت نشد' });

    const myMember = assertMember(groupId, userId);
    if (!myMember) return res.status(403).json({ message: 'شما عضو این گروه نیستید' });

    const body = req.body || {};
    const fromId = toInt(body.from_member_id);
    const toId = toInt(body.to_member_id);
    const amount = toInt(body.amount);
    const createTx = body.create_transaction === true;
    const txDate = body.transaction_date ? parseDate(body.transaction_date) : null;

    if (!Number.isFinite(fromId) || !Number.isFinite(toId) || fromId === toId) {
      return res.status(400).json({ message: 'اعضای تسویه نامعتبر است' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'مبلغ نامعتبر است' });
    }

    const fromM = stmts.getMember.get(fromId, groupId);
    const toM = stmts.getMember.get(toId, groupId);
    if (!fromM || !toM) return res.status(400).json({ message: 'عضو یافت نشد' });

    if (createTx) {
      if (fromM.user_id !== userId) {
        return res.status(403).json({ message: 'فقط می‌توانید تراکنش خود را ثبت کنید' });
      }
      if (!txDate) return res.status(400).json({ message: 'تاریخ تراکنش الزامی است' });
    }

    let settlementId;
    let transactionId = null;

    const tx = db.transaction(() => {
      const info = stmts.insertSettlement.run(
        groupId, fromId, toId, amount,
        body.note ? String(body.note).trim().slice(0, 300) : null,
        null
      );
      settlementId = Number(info.lastInsertRowid);

      if (createTx && fromM.user_id === userId) {
        const catId = findOrCreateSettlementCategory(userId);
        const title = `تسویه حساب — ${toM.display_name}`;
        const note = `گروه: ${group.name}`;
        const txInfo = stmts.insertTx.run(
          userId, amount, catId, title, note, txDate
        );
        transactionId = Number(txInfo.lastInsertRowid);
        stmts.updateSettlementTx.run(transactionId, settlementId);
      }

      markSharesSettled(fromId, groupId, amount, transactionId);
      stmts.touchGroup.run(groupId);
    });
    tx();

    return res.json({
      success: true,
      settlement: { id: settlementId, amount, transaction_id: transactionId },
    });
  } catch (err) {
    console.error('[split.settle]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function publicEndpoint(req, res) {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(404).json({ message: 'لینک نامعتبر است' });

    const group = stmts.getGroupByToken.get(token);
    if (!group) return res.status(404).json({ message: 'لینک نامعتبر است' });

    const { members, expenses, settlements, balances } = loadGroupData(group.id);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const mobile = normalizeMobile(req.query.mobile);

    let personal = null;
    if (mobile) {
      const member = stmts.memberByMobile.get(group.id, mobile);
      if (member) {
        const balance = balances[member.id] || 0;
        const myExpenses = [];
        for (const e of expenses) {
          const sh = (e.shares || []).find((x) => x.member_id === member.id);
          if (sh) {
            myExpenses.push({
              title: e.title,
              amount: e.amount,
              my_share: sh.share_amount,
              is_settled: Boolean(sh.is_settled),
              expense_date: e.expense_date,
            });
          }
        }

        const suggested = calculateMinimumSettlements(balances);
        const membersById = new Map(members.map((m) => [m.id, m]));
        const settlementsNeeded = suggested
          .filter((s) => s.from === member.id)
          .map((s) => ({
            pay_to: membersById.get(s.to)?.display_name || '—',
            amount: s.amount,
          }));

        personal = {
          display_name: member.display_name,
          balance,
          expenses: myExpenses,
          settlements_needed: settlementsNeeded,
        };
      }
    }

    return res.json({
      group: {
        name: group.name,
        description: group.description,
        member_count: members.length,
        total_expenses: totalExpenses,
      },
      personal,
      cta: { text: 'ثبت‌نام در دخلیار', url: '/' },
    });
  } catch (err) {
    console.error('[split.public]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function lookupMobileEndpoint(req, res) {
  try {
    const mobile = normalizeMobile(req.query.mobile);
    if (!mobile) return res.status(400).json({ message: 'شماره موبایل نامعتبر است' });
    const user = stmts.userByMobile.get(mobile);
    if (!user) return res.json({ registered: false, mobile });
    return res.json({
      registered: true,
      mobile,
      display_name: displayNameFromUser(user),
      user_id: user.id,
    });
  } catch (err) {
    console.error('[split.lookupMobile]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listGroupsEndpoint,
  createGroupEndpoint,
  getGroupEndpoint,
  addMemberEndpoint,
  removeMemberEndpoint,
  addExpenseEndpoint,
  patchExpenseEndpoint,
  deleteExpenseEndpoint,
  settleEndpoint,
  publicEndpoint,
  lookupMobileEndpoint,
};
