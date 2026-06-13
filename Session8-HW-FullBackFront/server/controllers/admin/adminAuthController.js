'use strict';

const bcrypt = require('bcrypt');
const db = require('../../db/adminDb');

const BCRYPT_ROUNDS = 12;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

function logActivity(adminId, action, opts = {}) {
  db.prepare(
    `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, detail, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    adminId,
    action,
    opts.target_type ?? null,
    opts.target_id ?? null,
    opts.detail ? JSON.stringify(opts.detail) : null,
    opts.ip ?? null
  );
}

function isValidPassword(v) {
  return typeof v === 'string' && PASSWORD_REGEX.test(v);
}

function publicAdmin(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    last_login: row.last_login ?? null,
  };
}

async function login(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'نام کاربری و رمز عبور الزامی است' });
    }

    const admin = db
      .prepare('SELECT * FROM admins WHERE username = ?')
      .get(String(username).trim());

    const ip = getClientIp(req);

    if (!admin) {
      return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    if (!admin.is_active) {
      return res.status(403).json({ message: 'حساب کاربری شما غیرفعال است' });
    }

    const ok = await bcrypt.compare(String(password), admin.password_hash);
    if (!ok) {
      logActivity(admin.id, 'login_failed', {
        ip,
        detail: { username: admin.username },
      });
      return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    req.session.adminId = admin.id;
    req.session.adminRole = admin.role;
    req.session.adminUsername = admin.username;

    const now = new Date().toISOString();
    db.prepare('UPDATE admins SET last_login = ? WHERE id = ?').run(now, admin.id);

    logActivity(admin.id, 'login', { ip });

    return res.json({
      success: true,
      admin: publicAdmin({ ...admin, last_login: now }),
      must_change: admin.must_change_password === 1,
    });
  } catch (err) {
    console.error('[adminAuth.login]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function logout(req, res) {
  const adminId = req.session.adminId;
  const ip = getClientIp(req);

  if (adminId) {
    logActivity(adminId, 'logout', { ip });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('[adminAuth.logout]', err);
      return res.status(500).json({ message: 'خطای سرور' });
    }
    res.clearCookie('dakhlyar_admin_sid');
    return res.json({ success: true });
  });
}

function me(req, res) {
  const admin = db
    .prepare(
      'SELECT id, username, email, role, last_login FROM admins WHERE id = ? AND is_active = 1'
    )
    .get(req.session.adminId);

  if (!admin) {
    return res.status(401).json({
      message: 'دسترسی غیرمجاز — لطفاً وارد پنل ادمین شوید',
    });
  }

  return res.json({ admin });
}

async function changePassword(req, res) {
  try {
    const { current_password, new_password, confirm_password } = req.body || {};

    if (!new_password || !confirm_password) {
      return res.status(400).json({ message: 'رمز عبور جدید و تکرار آن الزامی است' });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ message: 'رمز عبور و تکرار آن یکسان نیستند' });
    }

    if (!isValidPassword(new_password)) {
      return res.status(400).json({
        message:
          'رمز عبور باید حداقل ۸ کاراکتر و شامل یک حرف بزرگ، یک عدد و یک کاراکتر خاص باشد',
      });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.adminId);
    if (!admin || !admin.is_active) {
      return res.status(401).json({
        message: 'دسترسی غیرمجاز — لطفاً وارد پنل ادمین شوید',
      });
    }

    if (admin.must_change_password !== 1) {
      if (!current_password) {
        return res.status(400).json({ message: 'رمز عبور فعلی الزامی است' });
      }
      const ok = await bcrypt.compare(String(current_password), admin.password_hash);
      if (!ok) {
        return res.status(401).json({ message: 'رمز عبور فعلی اشتباه است' });
      }
    }

    const hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    db.prepare(
      'UPDATE admins SET password_hash = ?, must_change_password = 0 WHERE id = ?'
    ).run(hash, admin.id);

    logActivity(admin.id, 'change_password', { ip: getClientIp(req) });

    return res.json({
      success: true,
      message: 'رمز عبور با موفقیت تغییر یافت',
    });
  } catch (err) {
    console.error('[adminAuth.changePassword]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  login,
  logout,
  me,
  changePassword,
  logActivity,
  getClientIp,
};
