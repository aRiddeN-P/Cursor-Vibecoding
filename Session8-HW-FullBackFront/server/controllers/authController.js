/**
 * authController.js
 * All authentication endpoints for the user-facing Dakhlyar app.
 * Persian error messages, bcrypt hashing (rounds: 12), strict OTP lifecycle.
 */

const bcrypt = require('bcrypt');
const db = require('../db/appDb');
const { sendOtpEmail } = require('../utils/mailer');
const { trackDevice } = require('../utils/deviceTracker');
const { normalizeDigits } = require('../utils/digitHelper');
const messages = require('./messagesController');

// -------------------- Constants --------------------

const BCRYPT_ROUNDS = 12;
const OTP_TTL_SECONDS = 180;
const LOGIN_WINDOW_SECONDS = 600;
const LOGIN_MAX_FAILED = 3;

// -------------------- Validators --------------------

const MOBILE_REGEX = /^09[0-9]{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NATIONAL_ID_REGEX = /^[0-9]{10}$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
const BIRTH_DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function isValidMobile(v) {
  return typeof v === 'string' && MOBILE_REGEX.test(normalizeDigits(v));
}
function isValidEmail(v) {
  return typeof v === 'string' && EMAIL_REGEX.test(v);
}
function isValidNationalId(v) {
  return typeof v === 'string' && NATIONAL_ID_REGEX.test(normalizeDigits(v));
}
function isValidPassword(v) {
  return typeof v === 'string' && PASSWORD_REGEX.test(v);
}

function computeAgeYears(birthDateIso) {
  if (!BIRTH_DATE_REGEX.test(birthDateIso)) return null;
  const birth = new Date(birthDateIso + 'T00:00:00Z');
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function generate6DigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// -------------------- Prepared Statements --------------------

const stmts = {
  findUserByMobile: db.prepare('SELECT * FROM users WHERE mobile = ?'),
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserByNationalId: db.prepare('SELECT id FROM users WHERE national_id = ?'),
  insertUser: db.prepare(`
    INSERT INTO users (mobile, email, national_id, birth_date, password_hash, is_verified)
    VALUES (?, ?, ?, ?, ?, 1)
  `),
  updatePasswordHash: db.prepare(
    'UPDATE users SET password_hash = ? WHERE email = ?'
  ),

  // Phase 3-D — welcome message on first login
  selectFirstLoginFlag: db.prepare(
    'SELECT first_login_message_sent FROM users WHERE id = ?'
  ),
  markFirstLoginSent: db.prepare(
    'UPDATE users SET first_login_message_sent = 1 WHERE id = ?'
  ),

  insertOtp: db.prepare(`
    INSERT INTO otp_codes (email, code, type, expires_at, used)
    VALUES (?, ?, ?, ?, 0)
  `),
  invalidateOldOtps: db.prepare(`
    UPDATE otp_codes SET used = 1
    WHERE email = ? AND type = ? AND used = 0
  `),
  latestOtp: db.prepare(`
    SELECT * FROM otp_codes
    WHERE email = ? AND type = ?
    ORDER BY id DESC LIMIT 1
  `),
  markOtpUsed: db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?'),

  insertLoginAttempt: db.prepare(`
    INSERT INTO login_attempts (mobile, attempted_at, success)
    VALUES (?, ?, ?)
  `),
  countRecentFailures: db.prepare(`
    SELECT COUNT(*) as cnt
    FROM login_attempts
    WHERE mobile = ? AND success = 0 AND attempted_at > ?
  `),
  earliestRecentFailure: db.prepare(`
    SELECT MIN(attempted_at) as earliest
    FROM login_attempts
    WHERE mobile = ? AND success = 0 AND attempted_at > ?
  `),
};

// -------------------- POST /api/auth/login --------------------

async function login(req, res) {
  try {
    const { mobile: mobileRaw, password } = req.body || {};
    const mobile = normalizeDigits(String(mobileRaw || '').trim());

    if (!isValidMobile(mobile)) {
      return res.status(422).json({ message: 'فرمت شماره موبایل معتبر نیست' });
    }
    if (typeof password !== 'string' || password.length === 0) {
      return res
        .status(401)
        .json({ message: 'شماره موبایل یا رمز عبور اشتباه است', attempts_left: 2 });
    }

    const now = nowSeconds();
    const windowStart = now - LOGIN_WINDOW_SECONDS;

    const failureCount = stmts.countRecentFailures.get(mobile, windowStart).cnt;

    if (failureCount >= LOGIN_MAX_FAILED) {
      const earliest = stmts.earliestRecentFailure.get(mobile, windowStart).earliest;
      const remaining = Math.max(1, LOGIN_WINDOW_SECONDS - (now - earliest));
      return res.status(423).json({
        locked: true,
        message: 'حساب شما به مدت ۱۰ دقیقه قفل شده است',
        remaining_seconds: remaining,
      });
    }

    const user = stmts.findUserByMobile.get(mobile);

    if (!user) {
      // No account with this mobile — return a dedicated 404 (not counted as
      // a failed attempt because there is no account to lock). IP-level rate
      // limiting middleware still protects against enumeration brute-force.
      return res.status(404).json({
        message: 'حسابی با این شماره موبایل ثبت نشده است',
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      stmts.insertLoginAttempt.run(mobile, now, 0);
      const attemptsLeft = Math.max(0, LOGIN_MAX_FAILED - (failureCount + 1));
      return res.status(401).json({
        message: 'رمز عبور اشتباه است',
        attempts_left: attemptsLeft,
      });
    }

    stmts.insertLoginAttempt.run(mobile, now, 1);

    req.session.user_id = user.id;
    req.session.mobile = user.mobile;

    // Phase 3 — track device for "connected devices" list.
    // Tracking errors are swallowed inside the helper, so login is never affected.
    trackDevice(user.id, req);

    // Phase 3-D — welcome message, once per user. Fire-and-forget; never
    // blocks the login response.
    try {
      const flag = stmts.selectFirstLoginFlag.get(user.id);
      if (flag && Number(flag.first_login_message_sent) === 0) {
        messages.insertMessage({
          userId: user.id,
          title: 'به دخلیار خوش آمدید 🎉',
          body: 'خوشحالیم که به جمع کاربران دخلیار پیوستید. دخلیار همراه شما است تا مدیریت مالی شخصی‌تان را ساده‌تر و هوشمندتر کنید. برای شروع، پروفایل خود را تکمیل کنید.',
          type: 'admin_broadcast',
          relatedId: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        stmts.markFirstLoginSent.run(user.id);
      }
    } catch (welcomeErr) {
      console.error('[login] welcome message failed:', welcomeErr);
    }

    return res.json({
      success: true,
      user: { id: user.id, mobile: user.mobile },
    });
  } catch (err) {
    console.error('[login] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// -------------------- POST /api/auth/check-duplicates --------------------

function checkDuplicates(req, res) {
  try {
    const { mobile, email, national_id } = req.body || {};
    const result = {
      mobile_taken: false,
      email_taken: false,
      national_id_taken: false,
    };

    if (typeof mobile === 'string' && mobile.length > 0) {
      result.mobile_taken = !!stmts.findUserByMobile.get(normalizeDigits(mobile));
    }
    if (typeof email === 'string' && email.length > 0) {
      result.email_taken = !!stmts.findUserByEmail.get(email);
    }
    if (typeof national_id === 'string' && national_id.length > 0) {
      result.national_id_taken = !!stmts.findUserByNationalId.get(normalizeDigits(national_id));
    }

    return res.json(result);
  } catch (err) {
    console.error('[checkDuplicates] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// -------------------- POST /api/auth/send-otp --------------------

async function sendOtp(req, res) {
  try {
    const { email, type } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(422).json({ message: 'آدرس ایمیل معتبر نیست' });
    }
    if (type !== 'signup' && type !== 'reset_password') {
      return res
        .status(422)
        .json({ message: 'نوع کد معتبر نیست — مقدار مجاز: signup یا reset_password' });
    }

    if (type === 'reset_password') {
      const existing = stmts.findUserByEmail.get(email);
      if (!existing) {
        return res.status(404).json({ message: 'حسابی با این ایمیل یافت نشد' });
      }
    }

    stmts.invalidateOldOtps.run(email, type);

    const code = generate6DigitCode();
    const expiresAt = nowSeconds() + OTP_TTL_SECONDS;
    stmts.insertOtp.run(email, code, type, expiresAt);

    // Mailer logs the code to the console in all cases (dev-friendly),
    // and never throws — returns { sent, reason }.
    const result = await sendOtpEmail(email, code, type);

    const baseMsg =
      type === 'reset_password'
        ? 'کد بازیابی به ایمیل شما ارسال شد'
        : 'کد تایید به ایمیل شما ارسال شد';

    if (result.sent) {
      return res.json({ message: baseMsg });
    }
    // SMTP not configured or temporarily failed.
    // Code is still valid in DB and was printed to the server console.
    return res.json({
      message: baseMsg,
      smtp_warning:
        'ایمیل ارسال نشد — کد در کنسول سرور چاپ شده است (حالت توسعه).',
    });
  } catch (err) {
    console.error('[sendOtp] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// -------------------- POST /api/auth/verify-otp --------------------

function verifyOtp(req, res) {
  try {
    const { email, code, type } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(422).json({ message: 'آدرس ایمیل معتبر نیست' });
    }
    if (type !== 'signup' && type !== 'reset_password') {
      return res
        .status(422)
        .json({ message: 'نوع کد معتبر نیست — مقدار مجاز: signup یا reset_password' });
    }
    if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) {
      return res.status(400).json({ message: 'کد وارد شده اشتباه است' });
    }

    const record = stmts.latestOtp.get(email, type);
    if (!record) {
      return res.status(404).json({ message: 'کد معتبری یافت نشد' });
    }

    if (record.used === 1) {
      return res.status(400).json({ message: 'این کد قبلاً استفاده شده است' });
    }

    if (record.expires_at < nowSeconds()) {
      return res
        .status(400)
        .json({ message: 'کد منقضی شده است — لطفاً کد جدید درخواست کنید' });
    }

    if (record.code !== code) {
      return res.status(400).json({ message: 'کد وارد شده اشتباه است' });
    }

    stmts.markOtpUsed.run(record.id);
    req.session.otp_verified_email = `${email}:${type}`;

    return res.json({ verified: true });
  } catch (err) {
    console.error('[verifyOtp] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// -------------------- POST /api/auth/register --------------------

async function register(req, res) {
  try {
    const {
      mobile: mobileRaw,
      email,
      national_id: nationalIdRaw,
      birth_date,
      password,
      confirm_password,
    } = req.body || {};
    const mobile = normalizeDigits(String(mobileRaw || '').trim());
    const national_id = normalizeDigits(String(nationalIdRaw || '').trim());

    if (
      req.session.otp_verified_email !== `${email}:signup`
    ) {
      return res
        .status(403)
        .json({ message: 'ایمیل تایید نشده است — لطفاً ابتدا OTP را تایید کنید' });
    }

    if (!isValidMobile(mobile)) {
      return res.status(422).json({ message: 'فرمت شماره موبایل معتبر نیست' });
    }
    if (!isValidEmail(email)) {
      return res.status(422).json({ message: 'آدرس ایمیل معتبر نیست' });
    }
    if (!isValidNationalId(national_id)) {
      return res
        .status(422)
        .json({ message: 'فرمت کد ملی معتبر نیست — باید ۱۰ رقم عددی باشد' });
    }
    const age = computeAgeYears(birth_date);
    if (age === null) {
      return res.status(422).json({ message: 'فرمت تاریخ تولد معتبر نیست' });
    }
    if (age < 0) {
      return res.status(422).json({ message: 'تاریخ تولد نمی‌تواند در آینده باشد' });
    }
    if (age > 120) {
      return res
        .status(422)
        .json({ message: 'تاریخ تولد معتبر نیست — حداکثر سن مجاز ۱۲۰ سال است' });
    }
    if (!isValidPassword(password)) {
      return res.status(422).json({
        message:
          'رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد',
      });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ message: 'رمز عبور و تکرار آن یکسان نیستند' });
    }

    if (stmts.findUserByMobile.get(mobile)) {
      return res.status(409).json({ message: 'این شماره موبایل قبلاً ثبت شده است' });
    }
    if (stmts.findUserByEmail.get(email)) {
      return res.status(409).json({ message: 'این ایمیل قبلاً ثبت شده است' });
    }
    if (stmts.findUserByNationalId.get(national_id)) {
      return res.status(409).json({ message: 'این کد ملی قبلاً ثبت شده است' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const info = stmts.insertUser.run(mobile, email, national_id, birth_date, hash);

    delete req.session.otp_verified_email;

    // Phase 3-C — return the new user_id so the signup wizard can call
    // POST /api/referral/apply right after a successful registration.
    return res.json({
      success: true,
      message: 'ثبت‌نام با موفقیت انجام شد',
      user_id: Number(info.lastInsertRowid),
    });
  } catch (err) {
    console.error('[register] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// -------------------- POST /api/auth/forgot-password --------------------

async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(422).json({ message: 'آدرس ایمیل معتبر نیست' });
    }

    const user = stmts.findUserByEmail.get(email);
    if (!user) {
      return res.status(404).json({ message: 'حسابی با این ایمیل یافت نشد' });
    }

    stmts.invalidateOldOtps.run(email, 'reset_password');

    const code = generate6DigitCode();
    const expiresAt = nowSeconds() + OTP_TTL_SECONDS;
    stmts.insertOtp.run(email, code, 'reset_password', expiresAt);

    const result = await sendOtpEmail(email, code, 'reset_password');

    if (result.sent) {
      return res.json({ message: 'کد بازیابی به ایمیل شما ارسال شد' });
    }
    return res.json({
      message: 'کد بازیابی به ایمیل شما ارسال شد',
      smtp_warning:
        'ایمیل ارسال نشد — کد در کنسول سرور چاپ شده است (حالت توسعه).',
    });
  } catch (err) {
    console.error('[forgotPassword] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// -------------------- POST /api/auth/reset-password --------------------

async function resetPassword(req, res) {
  try {
    const { email, new_password, confirm_password } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(422).json({ message: 'آدرس ایمیل معتبر نیست' });
    }

    if (req.session.otp_verified_email !== `${email}:reset_password`) {
      return res.status(403).json({
        message: 'تایید OTP انجام نشده است — لطفاً ابتدا کد را تایید کنید',
      });
    }

    if (!isValidPassword(new_password)) {
      return res.status(422).json({
        message:
          'رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد',
      });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ message: 'رمز عبور و تکرار آن یکسان نیستند' });
    }

    const hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    stmts.updatePasswordHash.run(hash, email);

    delete req.session.otp_verified_email;

    return res.json({ success: true, message: 'رمز عبور با موفقیت تغییر یافت' });
  } catch (err) {
    console.error('[resetPassword] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// -------------------- POST /api/auth/logout (Phase 3) --------------------

function logout(req, res) {
  // Always idempotent — succeed even if there was no session.
  const send = () => res.json({ success: true, message: 'با موفقیت خارج شدید' });
  if (!req.session) return send();
  req.session.destroy((err) => {
    if (err) {
      console.error('[logout] session.destroy error:', err);
      return res.status(500).json({ message: 'خطای سرور' });
    }
    res.clearCookie('connect.sid');
    send();
  });
}

module.exports = {
  login,
  checkDuplicates,
  sendOtp,
  verifyOtp,
  register,
  forgotPassword,
  resetPassword,
  logout,
};
