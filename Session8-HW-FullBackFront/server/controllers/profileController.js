/**
 * profileController.js
 * GET/PATCH profile, change password, connected devices, invite code.
 *
 * Auth: every endpoint requires req.session.user_id (enforced at route level).
 * password_hash is NEVER returned in any response.
 * Fields locked by verification level cannot be edited.
 */

const bcrypt = require('bcrypt');
const db = require('../db/appDb');
const { PLANS } = require('../utils/plans');
const { getAvatarUrl } = require('../utils/avatarHelper');
const { normalizeDigits } = require('../utils/digitHelper');
const subCtrl = require('./subscriptionController');

// -------------------- Constants --------------------

const BCRYPT_ROUNDS = 12;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
const POSTAL_CODE_REGEX = /^[0-9]{10}$/;
const NATIONAL_ID_REGEX = /^[0-9]{10}$/;
const BIRTH_DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// -------------------- Prepared statements --------------------

const stmts = {
  selectUser: db.prepare(`
    SELECT id, mobile, email, national_id, birth_date,
           first_name, last_name, address, postal_code,
           verification_level, subscription_plan, subscription_expires_at,
           avatar_type, avatar_seed, avatar_custom_path, avatar_last_seed,
           has_seen_stories, created_at, password_hash
    FROM users WHERE id = ?
  `),
  updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  listDevices: db.prepare(`
    SELECT id, device_name, device_type, ip_address, last_active, created_at
    FROM connected_devices
    WHERE user_id = ?
    ORDER BY last_active DESC
  `),
  findDevice: db.prepare(
    'SELECT * FROM connected_devices WHERE id = ? AND user_id = ?'
  ),
  deleteDevice: db.prepare(
    'DELETE FROM connected_devices WHERE id = ? AND user_id = ?'
  ),
  existsByMobileExceptSelf: db.prepare(
    'SELECT 1 FROM users WHERE mobile = ? AND id <> ?'
  ),
  existsByEmailExceptSelf: db.prepare(
    'SELECT 1 FROM users WHERE email = ? AND id <> ?'
  ),
  existsByNationalIdExceptSelf: db.prepare(
    'SELECT 1 FROM users WHERE national_id = ? AND id <> ?'
  ),
};

// -------------------- Helpers --------------------

function sanitizeUser(u) {
  if (!u) return null;
  const plan = u.subscription_plan ? PLANS[u.subscription_plan] : null;
  const is_subscription_active = Boolean(
    u.subscription_plan &&
      u.subscription_expires_at &&
      new Date(u.subscription_expires_at).getTime() > Date.now()
  );
  return {
    id: u.id,
    mobile: u.mobile,
    email: u.email,
    national_id: u.national_id,
    birth_date: u.birth_date,
    first_name: u.first_name,
    last_name: u.last_name,
    address: u.address,
    postal_code: u.postal_code,
    verification_level: u.verification_level ?? 0,
    subscription_plan: u.subscription_plan,
    subscription_plan_name: plan ? plan.name : null,
    subscription_expires_at: u.subscription_expires_at,
    is_subscription_active,
    avatar_type: u.avatar_type || 'dicebear',
    avatar_seed: u.avatar_seed || null,
    avatar_url: getAvatarUrl(u),
    has_seen_stories: u.has_seen_stories ? 1 : 0,
    created_at: u.created_at,
  };
}

// ============================================================
//                       GET /api/profile
// ============================================================

function getProfile(req, res) {
  try {
    // Real-time subscription expiry check for this user before returning data.
    // If their sub just expired we'll see the cleaned-up row on the next SELECT.
    try { subCtrl.checkAndRevertExpiredSubscriptions(req.session.user_id); } catch (_) {}

    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }
    return res.json(sanitizeUser(user));
  } catch (err) {
    console.error('[getProfile] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//                      PATCH /api/profile
// ============================================================

const ALWAYS_EDITABLE = new Set(['first_name', 'last_name']);

function fieldsLockedAtLevel(level) {
  // Returns the set of field names that are read-only at this level or higher.
  const locked = new Set();
  if (level >= 1) { locked.add('mobile'); locked.add('national_id'); }
  if (level >= 2) { locked.add('birth_date'); }
  if (level >= 3) { locked.add('postal_code'); locked.add('address'); }
  return locked;
}

function patchProfile(req, res) {
  try {
    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    const body = req.body || {};
    const allowed = ['first_name', 'last_name', 'address', 'postal_code', 'national_id', 'birth_date'];
    const presented = allowed.filter((k) => Object.prototype.hasOwnProperty.call(body, k));

    if (!presented.length) {
      return res.status(400).json({ message: 'هیچ فیلدی برای بروزرسانی ارسال نشده است' });
    }

    const locked = fieldsLockedAtLevel(user.verification_level ?? 0);
    const lockedHit = presented.filter((k) => locked.has(k));
    if (lockedHit.length) {
      return res.status(403).json({
        message: 'این فیلد به دلیل احراز هویت قابل ویرایش نیست',
        locked_fields: lockedHit,
      });
    }

    // Normalize digit-only fields (Persian / Arabic-Indic → ASCII) before
    // validation so values that look right to the user are accepted.
    if (presented.includes('postal_code')) {
      body.postal_code = normalizeDigits(body.postal_code);
    }
    if (presented.includes('national_id')) {
      body.national_id = normalizeDigits(body.national_id);
    }

    // Per-field validation
    if (presented.includes('postal_code') && body.postal_code) {
      if (!POSTAL_CODE_REGEX.test(String(body.postal_code))) {
        return res.status(422).json({ message: 'کدپستی باید ۱۰ رقم عددی باشد' });
      }
    }
    if (presented.includes('national_id') && body.national_id) {
      if (!NATIONAL_ID_REGEX.test(String(body.national_id))) {
        return res.status(422).json({ message: 'کد ملی باید ۱۰ رقم عددی باشد' });
      }
      if (stmts.existsByNationalIdExceptSelf.get(String(body.national_id), user.id)) {
        return res.status(409).json({ message: 'این کد ملی قبلاً ثبت شده است' });
      }
    }
    if (presented.includes('birth_date') && body.birth_date) {
      if (!BIRTH_DATE_REGEX.test(String(body.birth_date))) {
        return res.status(422).json({ message: 'فرمت تاریخ تولد معتبر نیست' });
      }
    }
    if (presented.includes('first_name') && typeof body.first_name === 'string' && body.first_name.length > 80) {
      return res.status(422).json({ message: 'نام نباید بیش از ۸۰ کاراکتر باشد' });
    }
    if (presented.includes('last_name') && typeof body.last_name === 'string' && body.last_name.length > 80) {
      return res.status(422).json({ message: 'نام خانوادگی نباید بیش از ۸۰ کاراکتر باشد' });
    }

    // Build a single UPDATE for the presented fields
    const sets = presented.map((k) => `${k} = ?`).join(', ');
    const values = presented.map((k) => {
      const v = body[k];
      return typeof v === 'string' ? v.trim() : v;
    });
    values.push(user.id);
    db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...values);

    return res.json({
      success: true,
      message: 'اطلاعات با موفقیت بروزرسانی شد',
      updated_fields: presented,
    });
  } catch (err) {
    console.error('[patchProfile] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             POST /api/profile/change-password
// ============================================================

async function changePassword(req, res) {
  try {
    const { current_password, new_password, confirm_password } = req.body || {};
    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ message: 'تمام فیلدها الزامی هستند' });
    }

    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'رمز عبور فعلی اشتباه است' });
    }

    if (new_password === current_password) {
      return res
        .status(400)
        .json({ message: 'رمز عبور جدید نمیتواند با رمز فعلی یکسان باشد' });
    }

    if (!PASSWORD_REGEX.test(new_password)) {
      return res.status(422).json({
        message:
          'رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد',
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ message: 'رمز عبور و تکرار آن یکسان نیستند' });
    }

    const hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    stmts.updatePassword.run(hash, user.id);

    return res.json({ success: true, message: 'رمز عبور با موفقیت تغییر یافت' });
  } catch (err) {
    console.error('[changePassword] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//                 GET /api/profile/devices
// ============================================================

function listDevices(req, res) {
  try {
    const rows = stmts.listDevices.all(req.session.user_id);
    return res.json({ devices: rows });
  } catch (err) {
    console.error('[listDevices] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             DELETE /api/profile/devices/:deviceId
// ============================================================

function deleteDevice(req, res) {
  try {
    const id = Number.parseInt(req.params.deviceId, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه دستگاه معتبر نیست' });
    }
    const device = stmts.findDevice.get(id, req.session.user_id);
    if (!device) {
      return res.status(404).json({ message: 'دستگاه یافت نشد' });
    }
    stmts.deleteDevice.run(id, req.session.user_id);
    return res.json({ success: true, message: 'دستگاه با موفقیت حذف شد' });
  } catch (err) {
    console.error('[deleteDevice] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//                GET /api/profile/invite-code
// ============================================================

function getInviteCode(req, res) {
  try {
    const userId = req.session.user_id;
    return res.json({ invite_code: `DKHL-${userId}` });
  } catch (err) {
    console.error('[getInviteCode] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  getProfile,
  patchProfile,
  changePassword,
  listDevices,
  deleteDevice,
  getInviteCode,
  // helpers reused by other controllers
  _fieldsLockedAtLevel: fieldsLockedAtLevel,
  _sanitizeUser: sanitizeUser,
};
