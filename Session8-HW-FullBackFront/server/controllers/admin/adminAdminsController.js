'use strict';

const bcrypt = require('bcrypt');
const db = require('../../db/adminDb');
const { logActivity, getClientIp } = require('./adminAuthController');

const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function listAdmins(_req, res) {
  const admins = db
    .prepare(
      `SELECT id, username, email, role, is_active, last_login, created_at
       FROM admins ORDER BY id ASC`
    )
    .all();
  return res.json({ admins });
}

async function createAdmin(req, res) {
  try {
    const { username, email, password, role = 'admin' } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'نام کاربری، ایمیل و رمز عبور الزامی است' });
    }
    if (!EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({ message: 'فرمت ایمیل نامعتبر است' });
    }
    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ message: 'نقش نامعتبر است' });
    }

    const uname = String(username).trim();
    const mail = String(email).trim().toLowerCase();

    if (db.prepare('SELECT id FROM admins WHERE username = ?').get(uname)) {
      return res.status(409).json({ message: 'این نام کاربری قبلاً ثبت شده است' });
    }
    if (db.prepare('SELECT id FROM admins WHERE email = ?').get(mail)) {
      return res.status(409).json({ message: 'این ایمیل قبلاً ثبت شده است' });
    }

    const hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const result = db.prepare(
      `INSERT INTO admins (username, email, password_hash, role, is_active, must_change_password)
       VALUES (?, ?, ?, ?, 1, 0)`
    ).run(uname, mail, hash, role);

    logActivity(req.session.adminId, 'create_admin', {
      target_type: 'admin',
      target_id: result.lastInsertRowid,
      ip: getClientIp(req),
      detail: { username: uname, role },
    });

    return res.status(201).json({
      success: true,
      admin: { id: result.lastInsertRowid, username: uname, email: mail, role },
    });
  } catch (err) {
    console.error('[adminAdmins.createAdmin]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function updateAdmin(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    const target = db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ message: 'ادمین یافت نشد' });

    const { email, role, is_active, must_change_password } = req.body || {};
    const updates = [];
    const params = [];

    if (email !== undefined) {
      if (!EMAIL_REGEX.test(String(email).trim())) {
        return res.status(400).json({ message: 'فرمت ایمیل نامعتبر است' });
      }
      const mail = String(email).trim().toLowerCase();
      if (db.prepare('SELECT id FROM admins WHERE email = ? AND id != ?').get(mail, id)) {
        return res.status(409).json({ message: 'این ایمیل قبلاً ثبت شده است' });
      }
      updates.push('email = ?');
      params.push(mail);
    }
    if (role !== undefined) {
      if (!['admin', 'superadmin'].includes(role)) {
        return res.status(400).json({ message: 'نقش نامعتبر است' });
      }
      updates.push('role = ?');
      params.push(role);
    }
    if (is_active !== undefined) {
      const active = is_active ? 1 : 0;
      if (id === req.session.adminId && active === 0) {
        return res.status(400).json({ message: 'نمی‌توانید حساب خود را غیرفعال کنید' });
      }
      updates.push('is_active = ?');
      params.push(active);
    }
    if (must_change_password !== undefined) {
      updates.push('must_change_password = ?');
      params.push(must_change_password ? 1 : 0);
    }
    if (!updates.length) {
      return res.status(400).json({ message: 'فیلدی برای بروزرسانی ارسال نشده است' });
    }

    params.push(id);
    db.prepare(`UPDATE admins SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    logActivity(req.session.adminId, 'update_admin', {
      target_type: 'admin',
      target_id: id,
      ip: getClientIp(req),
      detail: req.body,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[adminAdmins.updateAdmin]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function deleteAdmin(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }
    if (id === req.session.adminId) {
      return res.status(400).json({ message: 'نمی‌توانید حساب خود را حذف کنید' });
    }
    const target = db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ message: 'ادمین یافت نشد' });

    if (target.role === 'superadmin') {
      const { cnt } = db
        .prepare("SELECT COUNT(*) AS cnt FROM admins WHERE role = 'superadmin' AND id != ?")
        .get(id);
      if (cnt === 0) {
        return res.status(400).json({ message: 'حداقل یک سوپر ادمین باید وجود داشته باشد' });
      }
    }

    db.prepare('DELETE FROM admins WHERE id = ?').run(id);
    logActivity(req.session.adminId, 'delete_admin', {
      target_type: 'admin',
      target_id: id,
      ip: getClientIp(req),
      detail: { username: target.username },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[adminAdmins.deleteAdmin]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = { listAdmins, createAdmin, updateAdmin, deleteAdmin };
