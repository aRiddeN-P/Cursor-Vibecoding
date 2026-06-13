/**
 * categoriesController.js — Phase 4
 *
 * Transaction categories (default + per-user custom).
 *
 *   GET   /api/categories                      — list visible categories
 *   POST  /api/categories/request              — request a new custom category
 *   GET   /api/categories/requests             — current user's requests
 *
 *   ADMIN GET   /api/admin/categories/requests
 *   ADMIN PATCH /api/admin/categories/requests/:id   { action, admin_note }
 *
 * Notes:
 *   - User custom categories are private to the requesting user.
 *   - Defaults (`is_default = 1`, `user_id IS NULL`) are visible to everyone.
 *   - Messages are emitted on request submit + admin decision via the
 *     existing messages system (Phase 3-D).
 */
'use strict';

const db = require('../db/appDb');
const messages = require('./messagesController');

// ─────────────────────────── Constants ──────────────────────────────────────

const TYPES = Object.freeze(['expense', 'income', 'both']);
const NAME_MAX = 30;
const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// ─────────────────────────── Prepared statements ────────────────────────────

const stmts = {
  // SELECT: defaults + this user's approved custom categories.
  listForUser: db.prepare(`
    SELECT id, name, icon, color, type, is_default
      FROM categories
     WHERE is_active = 1
       AND (
         (is_default = 1 AND user_id IS NULL)
         OR
         (is_default = 0 AND user_id = ?)
       )
     ORDER BY type, name
  `),

  listForUserByType: db.prepare(`
    SELECT id, name, icon, color, type, is_default
      FROM categories
     WHERE is_active = 1
       AND type = ?
       AND (
         (is_default = 1 AND user_id IS NULL)
         OR
         (is_default = 0 AND user_id = ?)
       )
     ORDER BY name
  `),

  // Dedup pending request by (user, name).
  findPendingByName: db.prepare(`
    SELECT id FROM category_requests
     WHERE user_id = ? AND lower(name) = lower(?) AND status = 'pending'
     LIMIT 1
  `),

  insertRequest: db.prepare(`
    INSERT INTO category_requests (user_id, name, icon, color, type)
    VALUES (?, ?, ?, ?, ?)
  `),

  userRequests: db.prepare(`
    SELECT id, name, icon, color, type, status, admin_note, created_at, reviewed_at
      FROM category_requests
     WHERE user_id = ?
     ORDER BY (status = 'pending') DESC, id DESC
  `),

  adminListRequests: db.prepare(`
    SELECT cr.id, cr.user_id, cr.name, cr.icon, cr.color, cr.type, cr.status,
           cr.admin_note, cr.created_at, cr.reviewed_at,
           u.mobile, u.email, u.first_name, u.last_name
      FROM category_requests cr
      JOIN users u ON u.id = cr.user_id
     ORDER BY (cr.status = 'pending') DESC, cr.id DESC
     LIMIT 500
  `),

  findRequest: db.prepare('SELECT * FROM category_requests WHERE id = ?'),

  approveRequest: db.prepare(`
    UPDATE category_requests
       SET status = 'approved', admin_note = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?
  `),

  rejectRequest: db.prepare(`
    UPDATE category_requests
       SET status = 'rejected', admin_note = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?
  `),

  insertApprovedCategory: db.prepare(`
    INSERT INTO categories (name, icon, color, type, is_default, user_id, is_active)
    VALUES (?, ?, ?, ?, 0, ?, 1)
  `),

  duplicateForUser: db.prepare(`
    SELECT id FROM categories
     WHERE user_id = ? AND lower(name) = lower(?) AND is_active = 1
     LIMIT 1
  `),
};

// ─────────────────────────── Helpers ────────────────────────────────────────

function sanitize(s, max = 200) {
  return String(s == null ? '' : s).trim().slice(0, max);
}

function validateBody(body) {
  const name  = sanitize(body && body.name, NAME_MAX + 1);
  const icon  = sanitize(body && body.icon, 16);
  const color = sanitize(body && body.color, 8);
  const type  = sanitize(body && body.type, 16);

  if (!name)                  return { ok: false, status: 422, message: 'نام دسته‌بندی الزامی است' };
  if (name.length > NAME_MAX) return { ok: false, status: 422, message: `نام دسته‌بندی نمی‌تواند بیش از ${NAME_MAX} کاراکتر باشد` };
  if (!icon)                  return { ok: false, status: 422, message: 'آیکون دسته‌بندی الزامی است' };
  if (!color || !COLOR_REGEX.test(color)) return { ok: false, status: 422, message: 'کد رنگ باید به فرمت hex مانند #1A5C3A باشد' };
  if (!TYPES.includes(type))  return { ok: false, status: 422, message: 'نوع دسته‌بندی نامعتبر است — مقادیر مجاز: expense | income | both' };

  return { ok: true, value: { name, icon, color, type } };
}

// ============================================================
//             GET /api/categories
// ============================================================

function listCategories(req, res) {
  try {
    const userId = req.session.user_id;
    const filter = req.query && typeof req.query.type === 'string' ? req.query.type : null;

    let rows;
    if (filter && TYPES.includes(filter)) {
      rows = stmts.listForUserByType.all(filter, userId);
    } else {
      rows = stmts.listForUser.all(userId);
    }
    // Convert is_default to a boolean for the client.
    return res.json({
      categories: rows.map((r) => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        color: r.color,
        type: r.type,
        is_default: r.is_default === 1,
      })),
    });
  } catch (err) {
    console.error('[categories.list] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             POST /api/categories/request
// ============================================================

function requestCategory(req, res) {
  try {
    const userId = req.session.user_id;
    const v = validateBody(req.body || {});
    if (!v.ok) return res.status(v.status).json({ message: v.message });

    // Block duplicate pending requests by the same user with the same name.
    if (stmts.findPendingByName.get(userId, v.value.name)) {
      return res.status(409).json({ message: 'درخواست مشابهی در حال بررسی است' });
    }
    // Also block if user already owns an active category with this name.
    if (stmts.duplicateForUser.get(userId, v.value.name)) {
      return res.status(409).json({ message: 'دسته‌بندی با این نام قبلاً برای شما اضافه شده است' });
    }

    const info = stmts.insertRequest.run(
      userId, v.value.name, v.value.icon, v.value.color, v.value.type
    );

    try {
      messages.insertMessage({
        userId,
        title: 'درخواست دسته‌بندی جدید ثبت شد',
        body: `درخواست دسته‌بندی «${v.value.name}» ثبت شد و در انتظار بررسی است.`,
        type: 'admin_direct',
        relatedId: Number(info.lastInsertRowid),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    } catch (msgErr) {
      console.error('[categories.request] message insert failed:', msgErr);
    }

    return res.json({
      success: true,
      message: 'درخواست دسته‌بندی ثبت شد',
      request_id: Number(info.lastInsertRowid),
    });
  } catch (err) {
    console.error('[categories.request] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             GET /api/categories/requests
// ============================================================

function listMyRequests(req, res) {
  try {
    const rows = stmts.userRequests.all(req.session.user_id);
    return res.json({ requests: rows });
  } catch (err) {
    console.error('[categories.listMyRequests] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        ADMIN: GET /api/admin/categories/requests
// ============================================================

function adminListRequests(_req, res) {
  try {
    const rows = stmts.adminListRequests.all();
    return res.json({ requests: rows });
  } catch (err) {
    console.error('[categories.adminListRequests] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//   ADMIN: PATCH /api/admin/categories/requests/:id
// ============================================================

function adminDecideRequest(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه درخواست معتبر نیست' });
    }
    const action = req.body && req.body.action;
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ message: "مقدار action نامعتبر است — 'approve' یا 'reject'" });
    }
    const adminNote = sanitize(req.body && req.body.admin_note, 500) || null;

    const reqRow = stmts.findRequest.get(id);
    if (!reqRow) return res.status(404).json({ message: 'درخواست یافت نشد' });
    if (reqRow.status !== 'pending') {
      return res.status(409).json({
        message: `این درخواست قبلاً ${reqRow.status === 'approved' ? 'تایید' : 'رد'} شده است`,
      });
    }

    if (action === 'approve') {
      const tx = db.transaction(() => {
        // Insert a per-user category. If user happens to already have it
        // (race / duplicate seed), skip the insert silently to keep the
        // approval idempotent.
        if (!stmts.duplicateForUser.get(reqRow.user_id, reqRow.name)) {
          stmts.insertApprovedCategory.run(
            reqRow.name, reqRow.icon, reqRow.color, reqRow.type, reqRow.user_id
          );
        }
        stmts.approveRequest.run(adminNote, id);
        try {
          messages.insertMessage({
            userId: reqRow.user_id,
            title: `دسته‌بندی «${reqRow.name}» تایید شد ✓`,
            body: `دسته‌بندی «${reqRow.name}» به لیست شما اضافه شد.${adminNote ? ' یادداشت ادمین: ' + adminNote : ''}`,
            type: 'admin_direct',
            relatedId: id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
        } catch (msgErr) {
          console.error('[categories.adminDecide] approve message failed:', msgErr);
        }
      });
      tx();
      return res.json({ success: true, message: 'درخواست تایید شد' });
    }

    // action === 'reject'
    const tx = db.transaction(() => {
      stmts.rejectRequest.run(adminNote, id);
      try {
        messages.insertMessage({
          userId: reqRow.user_id,
          title: `درخواست دسته‌بندی «${reqRow.name}» رد شد`,
          body: `درخواست دسته‌بندی «${reqRow.name}» رد شد.${adminNote ? ' دلیل: ' + adminNote : ''}`,
          type: 'admin_direct',
          relatedId: id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      } catch (msgErr) {
        console.error('[categories.adminDecide] message insert failed:', msgErr);
      }
    });
    tx();
    return res.json({ success: true, message: 'درخواست رد شد' });
  } catch (err) {
    console.error('[categories.adminDecide] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listCategories,
  requestCategory,
  listMyRequests,
  adminListRequests,
  adminDecideRequest,
};
