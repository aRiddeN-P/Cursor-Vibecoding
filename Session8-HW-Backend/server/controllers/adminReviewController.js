/**
 * adminReviewController.js
 * Admin-side review workflows for verification & subscription requests.
 *
 * Approving a verification request bumps user's verification_level to the
 * requested level (locking the corresponding fields for self-edit).
 *
 * Approving a subscription request sets the user's subscription_plan and
 * subscription_expires_at (now + duration_months).
 *
 * All actions insert a user-facing notification.
 */

const db = require('../db/appDb');
const { PLANS } = require('../utils/plans');
const { processReferralOnSubscriptionApproval } = require('../utils/discountHelper');
const messages = require('./messagesController');
const { toPersianDigits, jalaliDate } = require('../utils/timeHelper');
const push = require('../utils/pushHelper');

// ---------------- Prepared statements ----------------

const stmts = {
  // Verifications
  listVerif: db.prepare(`
    SELECT vr.id, vr.user_id, vr.requested_level, vr.status, vr.admin_note,
           vr.created_at, vr.reviewed_at,
           u.mobile, u.email, u.first_name, u.last_name,
           u.national_id, u.birth_date, u.postal_code, u.address,
           u.verification_level
    FROM verification_requests vr
    JOIN users u ON u.id = vr.user_id
    ORDER BY (vr.status = 'pending') DESC, vr.id DESC
    LIMIT 200
  `),
  findVerif: db.prepare(
    'SELECT * FROM verification_requests WHERE id = ?'
  ),
  selectUser: db.prepare(
    'SELECT id, verification_level FROM users WHERE id = ?'
  ),
  bumpUserLevel: db.prepare(
    'UPDATE users SET verification_level = ? WHERE id = ?'
  ),
  approveVerif: db.prepare(
    "UPDATE verification_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, admin_note = ? WHERE id = ?"
  ),
  rejectVerif: db.prepare(
    "UPDATE verification_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, admin_note = ? WHERE id = ?"
  ),

  // Subscriptions
  listSub: db.prepare(`
    SELECT sr.id, sr.user_id, sr.plan, sr.duration_months, sr.price,
           sr.status, sr.admin_note, sr.created_at, sr.reviewed_at,
           u.mobile, u.email, u.first_name, u.last_name,
           u.subscription_plan, u.subscription_expires_at
    FROM subscription_requests sr
    JOIN users u ON u.id = sr.user_id
    ORDER BY (sr.status = 'pending') DESC, sr.id DESC
    LIMIT 200
  `),
  findSub: db.prepare(
    'SELECT * FROM subscription_requests WHERE id = ?'
  ),
  activateSubscription: db.prepare(
    'UPDATE users SET subscription_plan = ?, subscription_expires_at = ? WHERE id = ?'
  ),
  approveSub: db.prepare(
    "UPDATE subscription_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, admin_note = ? WHERE id = ?"
  ),
  rejectSub: db.prepare(
    "UPDATE subscription_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, admin_note = ? WHERE id = ?"
  ),
};

// ---------------- Helpers ----------------

function faDigit(n) {
  return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

/** Adds `months` months to today and returns a YYYY-MM-DD (Gregorian) string. */
function addMonthsIso(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

// ============================================================
//             GET /api/admin/verifications
// ============================================================

function listVerifications(_req, res) {
  try {
    const rows = stmts.listVerif.all();
    return res.json({ requests: rows });
  } catch (err) {
    console.error('[admin.listVerifications] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        POST /api/admin/verifications/:id/approve
// ============================================================

function approveVerification(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه درخواست معتبر نیست' });
    }
    const note = (req.body && typeof req.body.note === 'string') ? req.body.note.trim().slice(0, 500) : null;

    const reqRow = stmts.findVerif.get(id);
    if (!reqRow) return res.status(404).json({ message: 'درخواست یافت نشد' });
    if (reqRow.status !== 'pending') {
      return res.status(409).json({ message: `این درخواست قبلاً ${reqRow.status === 'approved' ? 'تایید' : 'رد'} شده است` });
    }

    const user = stmts.selectUser.get(reqRow.user_id);
    if (!user) return res.status(404).json({ message: 'کاربر یافت نشد' });

    const target = reqRow.requested_level;
    // Only allow bumping to current_level + 1, otherwise reject the call.
    if (target !== (user.verification_level + 1)) {
      return res.status(409).json({
        message: `سطح فعلی کاربر ${faDigit(user.verification_level)} است؛ نمی‌توان مستقیماً به سطح ${faDigit(target)} ارتقاء داد`,
      });
    }

    let pushMsgId = null;
    const tx = db.transaction(() => {
      stmts.bumpUserLevel.run(target, reqRow.user_id);
      stmts.approveVerif.run(note, id);
      // Phase 3-D — upsert the original request message INTO a result one
      // so the user never sees two rows for the same verification topic.
      try {
        const upRes = messages.upsertResultMessage({
          userId: reqRow.user_id,
          relatedId: id,
          requestType: 'verification_request',
          resultType: 'verification_result',
          title: `احراز سطح ${faDigit(target)} تایید شد ✓`,
          body: `درخواست ارتقاء سطح احراز هویت شما به سطح ${faDigit(target)} تایید شد. تبریک!${note ? ' یادداشت ادمین: ' + note : ''}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        if (upRes && upRes.id) pushMsgId = upRes.id;
      } catch (msgErr) {
        console.error('[admin.approveVerification] message upsert failed:', msgErr);
      }
    });
    tx();

    // Phase 3-F — fire-and-forget Web Push.
    push.sendPushAsync(reqRow.user_id, {
      title: `احراز سطح ${faDigit(target)} تایید شد ✓`,
      body: 'درخواست ارتقاء سطح احراز هویت شما تایید شد.',
      tag: 'verification-result-' + id,
      url: '/messages.html',
      message_id: pushMsgId,
    });

    return res.json({ success: true, message: 'درخواست تایید شد', new_level: target });
  } catch (err) {
    console.error('[admin.approveVerification] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        POST /api/admin/verifications/:id/reject
// ============================================================

function rejectVerification(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه درخواست معتبر نیست' });
    }
    const note = (req.body && typeof req.body.note === 'string') ? req.body.note.trim().slice(0, 500) : null;

    const reqRow = stmts.findVerif.get(id);
    if (!reqRow) return res.status(404).json({ message: 'درخواست یافت نشد' });
    if (reqRow.status !== 'pending') {
      return res.status(409).json({ message: `این درخواست قبلاً ${reqRow.status === 'approved' ? 'تایید' : 'رد'} شده است` });
    }

    let pushMsgId = null;
    const tx = db.transaction(() => {
      stmts.rejectVerif.run(note, id);
      try {
        const upRes = messages.upsertResultMessage({
          userId: reqRow.user_id,
          relatedId: id,
          requestType: 'verification_request',
          resultType: 'verification_result',
          title: `درخواست احراز سطح ${faDigit(reqRow.requested_level)} رد شد`,
          body: `درخواست ارتقاء سطح احراز هویت شما به سطح ${faDigit(reqRow.requested_level)} رد شد.${note ? ' دلیل: ' + note : ''}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        if (upRes && upRes.id) pushMsgId = upRes.id;
      } catch (msgErr) {
        console.error('[admin.rejectVerification] message upsert failed:', msgErr);
      }
    });
    tx();

    push.sendPushAsync(reqRow.user_id, {
      title: `درخواست احراز سطح ${faDigit(reqRow.requested_level)} رد شد`,
      body: 'درخواست احراز هویت شما رد شد. برای جزئیات پیام‌ها را بررسی کنید.',
      tag: 'verification-result-' + id,
      url: '/messages.html',
      message_id: pushMsgId,
    });

    return res.json({ success: true, message: 'درخواست رد شد' });
  } catch (err) {
    console.error('[admin.rejectVerification] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             GET /api/admin/subscriptions
// ============================================================

function listSubscriptions(_req, res) {
  try {
    const rows = stmts.listSub.all().map((r) => ({
      ...r,
      plan_name: PLANS[r.plan] ? PLANS[r.plan].name : r.plan,
    }));
    return res.json({ requests: rows });
  } catch (err) {
    console.error('[admin.listSubscriptions] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        POST /api/admin/subscriptions/:id/approve
// ============================================================

function approveSubscription(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه درخواست معتبر نیست' });
    }
    const note = (req.body && typeof req.body.note === 'string') ? req.body.note.trim().slice(0, 500) : null;

    const reqRow = stmts.findSub.get(id);
    if (!reqRow) return res.status(404).json({ message: 'درخواست یافت نشد' });
    if (reqRow.status !== 'pending') {
      return res.status(409).json({ message: `این درخواست قبلاً ${reqRow.status === 'approved' ? 'تایید' : 'رد'} شده است` });
    }

    const plan = PLANS[reqRow.plan];
    if (!plan) return res.status(400).json({ message: 'پلن این درخواست در سرور معتبر نیست' });

    const expiresAt = addMonthsIso(plan.duration_months);

    // Phase 3-C: collected here so we can return it to the admin UI.
    let referralResult = null;
    let pushMsgId = null;

    const tx = db.transaction(() => {
      stmts.activateSubscription.run(plan.key, expiresAt, reqRow.user_id);
      stmts.approveSub.run(note, id);
      // Phase 3-D — upsert request → result.
      try {
        const upRes = messages.upsertResultMessage({
          userId: reqRow.user_id,
          relatedId: id,
          requestType: 'subscription_request',
          resultType: 'subscription_result',
          title: `اشتراک ${plan.name} فعال شد ✓`,
          body: `اشتراک ${plan.name} شما با موفقیت فعال شد. تاریخ انقضا: ${jalaliDate(expiresAt)}.${note ? ' یادداشت: ' + note : ''}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        if (upRes && upRes.id) pushMsgId = upRes.id;
      } catch (msgErr) {
        console.error('[admin.approveSubscription] message upsert failed:', msgErr);
      }
      // Phase 3-C — referral discount bookkeeping. Runs inside the same tx
      // so the subscription approval + discount records are atomic.
      try {
        referralResult = processReferralOnSubscriptionApproval(reqRow);
      } catch (refErr) {
        // Don't roll back the subscription approval for referral bookkeeping
        // failures — log and continue. The message queue will catch up
        // later if needed.
        console.error('[admin.approveSubscription] referral hook failed:', refErr);
      }
    });
    tx();

    // Phase 3-F — fire-and-forget Web Push. requireInteraction true for
    // subscription approval so user sees it even if phone was idle.
    push.sendPushAsync(reqRow.user_id, {
      title: `اشتراک ${plan.name} فعال شد ✓`,
      body: 'اشتراک شما با موفقیت فعال شد.',
      tag: 'subscription-result-' + id,
      requireInteraction: true,
      url: '/messages.html',
      message_id: pushMsgId,
    });

    return res.json({
      success: true,
      message: 'درخواست تایید و اشتراک فعال شد',
      plan: plan.key,
      expires_at: expiresAt,
      referral: referralResult,
    });
  } catch (err) {
    console.error('[admin.approveSubscription] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        POST /api/admin/subscriptions/:id/reject
// ============================================================

function rejectSubscription(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه درخواست معتبر نیست' });
    }
    const note = (req.body && typeof req.body.note === 'string') ? req.body.note.trim().slice(0, 500) : null;

    const reqRow = stmts.findSub.get(id);
    if (!reqRow) return res.status(404).json({ message: 'درخواست یافت نشد' });
    if (reqRow.status !== 'pending') {
      return res.status(409).json({ message: `این درخواست قبلاً ${reqRow.status === 'approved' ? 'تایید' : 'رد'} شده است` });
    }

    const planName = PLANS[reqRow.plan] ? PLANS[reqRow.plan].name : reqRow.plan;

    let pushMsgId = null;
    const tx = db.transaction(() => {
      stmts.rejectSub.run(note, id);
      try {
        const upRes = messages.upsertResultMessage({
          userId: reqRow.user_id,
          relatedId: id,
          requestType: 'subscription_request',
          resultType: 'subscription_result',
          title: `درخواست اشتراک ${planName} رد شد`,
          body: `درخواست خرید اشتراک ${planName} شما رد شد.${note ? ' دلیل: ' + note : ''}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        if (upRes && upRes.id) pushMsgId = upRes.id;
      } catch (msgErr) {
        console.error('[admin.rejectSubscription] message upsert failed:', msgErr);
      }
    });
    tx();

    push.sendPushAsync(reqRow.user_id, {
      title: `درخواست اشتراک ${planName} رد شد`,
      body: 'درخواست خرید اشتراک شما رد شد.',
      tag: 'subscription-result-' + id,
      url: '/messages.html',
      message_id: pushMsgId,
    });

    return res.json({ success: true, message: 'درخواست رد شد' });
  } catch (err) {
    console.error('[admin.rejectSubscription] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listVerifications,
  approveVerification,
  rejectVerification,
  listSubscriptions,
  approveSubscription,
  rejectSubscription,
};
