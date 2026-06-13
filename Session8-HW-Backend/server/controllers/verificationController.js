/**
 * verificationController.js
 * Verification levels 0..3 with progressive requirements:
 *   0 → email (basic, assigned at signup)
 *   1 → mobile + national_id
 *   2 → birth_date
 *   3 → postal_code + address
 *
 * A user can only request the NEXT level above their current one,
 * and only one pending request is allowed at a time.
 */

const db = require('../db/appDb');
const messages = require('./messagesController');

const REQUIRED_FIELDS = {
  1: ['mobile', 'national_id'],
  2: ['birth_date'],
  3: ['postal_code', 'address'],
};

const FIELD_LABELS = {
  mobile: 'شماره موبایل',
  national_id: 'کد ملی',
  birth_date: 'تاریخ تولد',
  postal_code: 'کدپستی',
  address: 'آدرس',
};

const stmts = {
  selectUser: db.prepare(
    'SELECT id, mobile, national_id, birth_date, postal_code, address, verification_level FROM users WHERE id = ?'
  ),
  selectPending: db.prepare(`
    SELECT id, requested_level, status, admin_note, created_at
    FROM verification_requests
    WHERE user_id = ? AND status = 'pending'
    ORDER BY id DESC LIMIT 1
  `),
  selectLatestForLevel: db.prepare(`
    SELECT id, status, admin_note, created_at, reviewed_at
    FROM verification_requests
    WHERE user_id = ? AND requested_level = ?
    ORDER BY id DESC LIMIT 1
  `),
  insertRequest: db.prepare(`
    INSERT INTO verification_requests (user_id, requested_level, status)
    VALUES (?, ?, 'pending')
  `),
};

// ============================================================
//             GET /api/verification/status
// ============================================================

function getStatus(req, res) {
  try {
    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    const current_level = user.verification_level ?? 0;
    const pending = stmts.selectPending.get(user.id);

    // Build per-level history for the UI stepper
    const levels = [1, 2, 3].map((lvl) => {
      const latest = stmts.selectLatestForLevel.get(user.id, lvl);
      let state = 'available'; // default
      if (lvl <= current_level) state = 'approved';
      else if (latest && latest.status === 'pending') state = 'pending';
      else if (latest && latest.status === 'rejected') state = 'rejected';
      if (lvl > current_level + 1) state = 'locked';

      const required = REQUIRED_FIELDS[lvl] || [];
      const missing = required.filter((f) => !user[f]);

      return {
        level: lvl,
        state,
        required_fields: required,
        missing_fields: missing,
        last_request: latest || null,
      };
    });

    return res.json({
      current_level,
      pending_request: pending || null,
      levels,
    });
  } catch (err) {
    console.error('[verification.getStatus] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             POST /api/verification/request
// ============================================================

function postRequest(req, res) {
  try {
    const requested = Number.parseInt((req.body || {}).requested_level, 10);
    if (![1, 2, 3].includes(requested)) {
      return res.status(400).json({
        message: 'سطح درخواستی معتبر نیست — مقادیر مجاز: ۱، ۲ یا ۳',
      });
    }

    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    const current = user.verification_level ?? 0;
    if (requested !== current + 1) {
      return res.status(400).json({
        message: 'شما فقط می‌توانید سطح بعدی را درخواست دهید',
        current_level: current,
        next_allowed: current + 1,
      });
    }

    const pending = stmts.selectPending.get(user.id);
    if (pending) {
      return res
        .status(409)
        .json({ message: 'یک درخواست در حال بررسی دارید', pending });
    }

    const required = REQUIRED_FIELDS[requested] || [];
    const missing = required.filter((f) => !user[f]);
    if (missing.length) {
      const labels = missing.map((f) => FIELD_LABELS[f] || f).join('، ');
      return res.status(422).json({
        message: `لطفاً ابتدا اطلاعات مورد نیاز این سطح را در پروفایل تکمیل کنید: ${labels}`,
        missing_fields: missing,
      });
    }

    const info = stmts.insertRequest.run(user.id, requested);
    const requestId = Number(info.lastInsertRowid);

    // Phase 3-D — replaces legacy notifications.insert with the new messages
    // pipeline. Request messages have no expiry; they get UPSERTED into a
    // result message by adminReviewController on approve/reject.
    try {
      messages.insertMessage({
        userId: user.id,
        title: `درخواست احراز سطح ${toFa(requested)}`,
        body: `درخواست ارتقاء سطح احراز هویت شما به سطح ${toFa(requested)} ثبت شد و در انتظار بررسی است.`,
        type: 'verification_request',
        relatedId: requestId,
        expiresAt: null,
      });
    } catch (msgErr) {
      console.error('[verification.postRequest] message insert failed:', msgErr);
    }

    return res.json({
      success: true,
      message: 'درخواست احراز هویت ثبت شد و در انتظار بررسی است',
      request_id: requestId,
    });
  } catch (err) {
    console.error('[verification.postRequest] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function toFa(n) {
  return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

module.exports = { getStatus, postRequest };
