'use strict';

const appDb = require('../../db/appDb');
const categoriesCtrl = require('../categoriesController');
const { logActivity, getClientIp } = require('./adminAuthController');

const TYPES = new Set(['expense', 'income', 'both']);
const NAME_MAX = 30;
const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const stmts = {
  listRequests: appDb.prepare(`
    SELECT cr.id, cr.user_id, cr.name, cr.icon, cr.color, cr.type, cr.status,
           cr.admin_note, cr.created_at, cr.reviewed_at,
           u.mobile, u.email, u.first_name, u.last_name
    FROM category_requests cr
    JOIN users u ON u.id = cr.user_id
    WHERE (? = 'all' OR cr.status = ?)
    ORDER BY (cr.status = 'pending') DESC, cr.id DESC
    LIMIT ? OFFSET ?
  `),
  countRequests: appDb.prepare(`
    SELECT COUNT(*) AS cnt FROM category_requests
    WHERE (? = 'all' OR status = ?)
  `),
  listDefaults: appDb.prepare(`
    SELECT id, name, icon, color, type, is_active, created_at
    FROM categories
    WHERE is_default = 1 AND user_id IS NULL
    ORDER BY type, name
  `),
  getDefault: appDb.prepare(`
    SELECT * FROM categories WHERE id = ? AND is_default = 1 AND user_id IS NULL
  `),
  insertDefault: appDb.prepare(`
    INSERT INTO categories (name, icon, color, type, is_default, user_id, is_active)
    VALUES (?, ?, ?, ?, 1, NULL, 1)
  `),
  updateDefault: appDb.prepare(`
    UPDATE categories SET name = ?, icon = ?, color = ?, type = ?, is_active = ?
    WHERE id = ? AND is_default = 1 AND user_id IS NULL
  `),
};

function sanitize(str, max) {
  if (str == null) return '';
  return String(str).trim().slice(0, max);
}

function listRequests(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const offset = (page - 1) * limit;
    const status = req.query.status || 'all';
    const allowed = ['all', 'pending', 'approved', 'rejected'];
    const st = allowed.includes(status) ? status : 'all';

    const { cnt: total } = stmts.countRequests.get(st, st);
    const rows = stmts.listRequests.all(st, st, limit, offset);

    return res.json({
      requests: rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        icon: r.icon,
        color: r.color,
        type: r.type,
        status: r.status,
        admin_note: r.admin_note,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        user: {
          mobile: r.mobile,
          email: r.email,
          first_name: r.first_name,
          last_name: r.last_name,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (err) {
    console.error('[adminCategories.listRequests]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function decideRequest(req, res) {
  const origJson = res.json.bind(res);
  res.json = (body) => {
    if (body && body.success) {
      const action = req.body?.action === 'approve' ? 'approve_category' : 'reject_category';
      logActivity(req.session.adminId, action, {
        target_type: 'category',
        target_id: Number(req.params.id),
        ip: getClientIp(req),
      });
    }
    return origJson(body);
  };
  return categoriesCtrl.adminDecideRequest(req, res);
}

function listDefaults(_req, res) {
  try {
    const categories = stmts.listDefaults.all();
    return res.json({ categories });
  } catch (err) {
    console.error('[adminCategories.listDefaults]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function createDefault(req, res) {
  try {
    const { name, icon, color, type } = req.body || {};
    const n = sanitize(name, NAME_MAX);
    if (!n) return res.status(400).json({ message: 'نام دسته‌بندی الزامی است' });
    if (!TYPES.has(type)) return res.status(400).json({ message: 'نوع دسته‌بندی نامعتبر است' });
    if (!COLOR_REGEX.test(String(color || ''))) {
      return res.status(400).json({ message: 'رنگ نامعتبر است' });
    }
    const ic = sanitize(icon, 4) || '📁';

    const info = stmts.insertDefault.run(n, ic, String(color).toUpperCase(), type);
    logActivity(req.session.adminId, 'create_default_category', {
      target_type: 'category',
      target_id: info.lastInsertRowid,
      ip: getClientIp(req),
      detail: { name: n },
    });
    return res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error('[adminCategories.createDefault]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function patchDefault(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    const row = stmts.getDefault.get(id);
    if (!row) return res.status(404).json({ message: 'دسته‌بندی یافت نشد' });

    const name = req.body.name != null ? sanitize(req.body.name, NAME_MAX) : row.name;
    const icon = req.body.icon != null ? sanitize(req.body.icon, 4) : row.icon;
    const color = req.body.color != null ? String(req.body.color).toUpperCase() : row.color;
    const type = req.body.type != null ? req.body.type : row.type;
    const isActive = req.body.is_active !== undefined
      ? (req.body.is_active ? 1 : 0)
      : row.is_active;

    if (!name) return res.status(400).json({ message: 'نام الزامی است' });
    if (!TYPES.has(type)) return res.status(400).json({ message: 'نوع دسته‌بندی نامعتبر است' });
    if (!COLOR_REGEX.test(color)) return res.status(400).json({ message: 'رنگ نامعتبر است' });

    stmts.updateDefault.run(name, icon || '📁', color, type, isActive, id);
    logActivity(req.session.adminId, 'update_default_category', {
      target_type: 'category',
      target_id: id,
      ip: getClientIp(req),
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[adminCategories.patchDefault]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listRequests,
  decideRequest,
  listDefaults,
  createDefault,
  patchDefault,
};
