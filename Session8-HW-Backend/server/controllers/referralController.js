/**
 * referralController.js — Phase 3-C (Referral / Invite system)
 *
 * Endpoints:
 *   GET    /api/referral/validate/:code   (public)   — verify a code looks real
 *   POST   /api/referral/apply            (public)   — link an invitee to an inviter
 *   GET    /api/referral/discount         (auth)     — current invitee discount, if any
 *   GET    /api/referral/my-invites       (auth)     — inviter dashboard payload
 *
 * Public endpoints are deliberately session-less so the signup flow can hit
 * them BEFORE the user logs in. They never expose sensitive data — only the
 * masked first-name + last-initial of the inviter.
 */

const db = require('../db/appDb');
const helper = require('../utils/discountHelper');
const messages = require('./messagesController');
const push = require('../utils/pushHelper');

// ─────────────────────────── Constants ──────────────────────────────────────

const INVITE_CODE_REGEX = /^DKHL-\d+$/;

// ─────────────────────────── Prepared statements ────────────────────────────

const stmts = {
  selectUserById: db.prepare(
    `SELECT id, first_name, last_name, mobile,
            subscription_plan, subscription_expires_at,
            referred_by_code, referral_discount_count, created_at
       FROM users WHERE id = ?`
  ),
  selectUserShortById: db.prepare(
    'SELECT id, first_name, last_name FROM users WHERE id = ?'
  ),
  insertReferral: db.prepare(`
    INSERT INTO referrals (inviter_user_id, invitee_user_id, invite_code, inviter_plan_at_signup)
    VALUES (?, ?, ?, ?)
  `),
  setInviteeReferredBy: db.prepare(
    'UPDATE users SET referred_by_code = ? WHERE id = ? AND referred_by_code IS NULL'
  ),
  countMyInvites: db.prepare(
    'SELECT COUNT(*) AS cnt FROM referrals WHERE inviter_user_id = ?'
  ),
  listMyInvites: db.prepare(`
    SELECT r.id, r.invitee_user_id, r.created_at,
           u.first_name, u.last_name
      FROM referrals r
      JOIN users u ON u.id = r.invitee_user_id
     WHERE r.inviter_user_id = ?
     ORDER BY r.id DESC
     LIMIT 200
  `),
  purchasedByInvitee: db.prepare(`
    SELECT 1 FROM referral_discounts
     WHERE referral_id = ? AND source = 'invitee' AND is_used = 1
     LIMIT 1
  `),
  inviterDiscountForReferral: db.prepare(`
    SELECT discount_percent
      FROM referral_discounts
     WHERE referral_id = ? AND source = 'inviter'
     ORDER BY id ASC
     LIMIT 1
  `),
};

// ─────────────────────────── Helpers ────────────────────────────────────────

/**
 * "علی محمدی" → "علی م."
 * "علی"       → "علی"
 * If both names are empty → "کاربر دخلیار"
 */
function maskName(firstName, lastName) {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (!f && !l) return 'کاربر دخلیار';
  if (!l) return f;
  if (!f) return l.charAt(0) + '.';
  return `${f} ${l.charAt(0)}.`;
}

function parseInviteeId(code) {
  if (typeof code !== 'string') return null;
  const m = code.match(/^DKHL-(\d+)$/);
  if (!m) return null;
  const id = Number.parseInt(m[1], 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ============================================================
//        GET /api/referral/validate/:code   (PUBLIC)
// ============================================================

function validateCode(req, res) {
  try {
    const code = String(req.params.code || '').toUpperCase().trim();
    if (!INVITE_CODE_REGEX.test(code)) {
      return res.status(400).json({ message: 'فرمت کد دعوت صحیح نیست' });
    }
    const inviterId = parseInviteeId(code);
    const inviter = inviterId ? stmts.selectUserShortById.get(inviterId) : null;
    if (!inviter) {
      return res.status(404).json({ message: 'کد دعوت معتبر نیست' });
    }
    return res.json({
      valid: true,
      inviter_name: maskName(inviter.first_name, inviter.last_name),
    });
  } catch (err) {
    console.error('[referral.validateCode] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        POST /api/referral/apply   (PUBLIC, post-register)
// ============================================================

function applyReferral(req, res) {
  try {
    const body = req.body || {};
    const inviteeUserId = Number.parseInt(body.invitee_user_id, 10);
    const inviteCode = String(body.invite_code || '').toUpperCase().trim();

    if (!Number.isInteger(inviteeUserId) || inviteeUserId < 1) {
      return res.status(400).json({ message: 'شناسه کاربر معتبر نیست' });
    }
    if (!INVITE_CODE_REGEX.test(inviteCode)) {
      return res.status(400).json({ message: 'فرمت کد دعوت صحیح نیست' });
    }

    const invitee = stmts.selectUserById.get(inviteeUserId);
    if (!invitee) {
      return res.status(404).json({ message: 'کاربر یافت نشد' });
    }
    if (invitee.referred_by_code) {
      return res.status(409).json({ message: 'کد دعوت قبلاً ثبت شده است' });
    }

    const inviterId = parseInviteeId(inviteCode);
    if (!inviterId) {
      return res.status(400).json({ message: 'فرمت کد دعوت صحیح نیست' });
    }
    if (inviterId === invitee.id) {
      return res.status(400).json({ message: 'نمی‌توانید از کد دعوت خود استفاده کنید' });
    }

    const inviter = stmts.selectUserById.get(inviterId);
    if (!inviter) {
      return res.status(404).json({ message: 'کد دعوت معتبر نیست' });
    }

    const inviterPlanAtSignup = helper.hasActiveSubscription(inviter)
      ? inviter.subscription_plan
      : null;

    // Atomic: write the referral, flip the invitee's `referred_by_code`,
    // and (when applicable) lock in their 10-day discount entitlement.
    let referralId = null;
    const tx = db.transaction(() => {
      const info = stmts.insertReferral.run(
        inviter.id,
        invitee.id,
        inviteCode,
        inviterPlanAtSignup
      );
      const updated = stmts.setInviteeReferredBy.run(inviteCode, invitee.id);
      if (updated.changes === 0) {
        // someone else applied a code for this user between our read & write
        throw new Error('REFERRAL_RACE');
      }
      referralId = Number(info.lastInsertRowid);
      helper.maybeCreateInviteeDiscount(invitee, inviter, referralId);
    });
    try {
      tx();
    } catch (e) {
      if (e && e.message === 'REFERRAL_RACE') {
        return res.status(409).json({ message: 'کد دعوت قبلاً ثبت شده است' });
      }
      // UNIQUE constraint on invitee_user_id is the same situation.
      if (e && e.message && e.message.includes('UNIQUE') && e.message.includes('invitee_user_id')) {
        return res.status(409).json({ message: 'کد دعوت قبلاً ثبت شده است' });
      }
      throw e;
    }

    // Phase 3-D — notify the INVITER that one of their codes was redeemed.
    // Skipped silently if the message insert fails (referral was already
    // committed; messaging is best-effort).
    let inviterMsgId = null;
    try {
      inviterMsgId = messages.insertMessage({
        userId: inviter.id,
        title: 'دعوت شما ثمر داد!',
        body: 'یک نفر با کد دعوت شما در دخلیار ثبت‌نام کرد. در صورتی که اشتراک تهیه کند، تخفیف ویژه به حساب شما اضافه می‌شود.',
        type: 'referral',
        relatedId: referralId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    } catch (msgErr) {
      console.error('[referral.applyReferral] inviter message failed:', msgErr);
    }

    // Phase 3-F — Web Push to inviter (fire-and-forget).
    push.sendPushAsync(inviter.id, {
      title: 'دعوت شما ثمر داد!',
      body: 'یک نفر با کد دعوت شما ثبت‌نام کرد.',
      tag: 'referral-joined-' + referralId,
      url: '/messages.html',
      message_id: inviterMsgId,
    });

    return res.json({ success: true, message: 'کد دعوت با موفقیت ثبت شد' });
  } catch (err) {
    console.error('[referral.applyReferral] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        GET /api/referral/discount   (AUTH)
// ============================================================

function getDiscount(req, res) {
  try {
    const d = helper.getActiveInviteeDiscount(req.session.user_id);
    if (!d) {
      return res.json({ has_discount: false });
    }
    return res.json({
      has_discount: true,
      discount_percent: d.discount_percent,
      expires_at: d.expires_at,
      source: 'invitee',
    });
  } catch (err) {
    console.error('[referral.getDiscount] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        GET /api/referral/my-invites   (AUTH)
// ============================================================

function myInvites(req, res) {
  try {
    const userId = req.session.user_id;
    const me = stmts.selectUserById.get(userId);
    if (!me) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    const rows = stmts.listMyInvites.all(userId);
    const invites = rows.map((r) => {
      const purchased = !!stmts.purchasedByInvitee.get(r.id);
      const ownDisc = stmts.inviterDiscountForReferral.get(r.id);
      return {
        id: r.id,
        invitee_name: maskName(r.first_name, r.last_name),
        joined_at: r.created_at,
        purchased_subscription: purchased,
        discount_earned: ownDisc ? `${ownDisc.discount_percent}%` : null,
      };
    });

    const earned = Number(me.referral_discount_count || 0);
    const pending = helper.getPendingInviterDiscountPercent(userId);

    return res.json({
      total_invites: rows.length,
      discount_earned_count: earned,
      discount_remaining: Math.max(0, helper.MAX_INVITER_REFERRAL_COUNT - earned),
      pending_inviter_discount_percent: pending,
      invite_code: `DKHL-${userId}`,
      invites,
    });
  } catch (err) {
    console.error('[referral.myInvites] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        ADMIN  GET /api/admin/referrals
// ============================================================

function adminListReferrals(_req, res) {
  try {
    const rows = db.prepare(`
      SELECT r.id, r.inviter_user_id, r.invitee_user_id, r.invite_code,
             r.inviter_plan_at_signup, r.created_at,
             iv.first_name AS invitee_first, iv.last_name AS invitee_last,
             iv.mobile AS invitee_mobile, iv.created_at AS invitee_joined,
             iu.first_name AS inviter_first, iu.last_name AS inviter_last,
             iu.mobile AS inviter_mobile, iu.subscription_plan AS inviter_plan
        FROM referrals r
        JOIN users iv ON iv.id = r.invitee_user_id
        JOIN users iu ON iu.id = r.inviter_user_id
        ORDER BY r.id DESC
        LIMIT 500
    `).all();

    const referrals = rows.map((r) => {
      const purchased = !!stmts.purchasedByInvitee.get(r.id);
      const ownDisc = stmts.inviterDiscountForReferral.get(r.id);
      const inviteeDiscRow = db.prepare(
        "SELECT discount_percent FROM referral_discounts WHERE referral_id = ? AND source = 'invitee' AND is_used = 1 ORDER BY id ASC LIMIT 1"
      ).get(r.id);
      return {
        id: r.id,
        inviter: {
          id: r.inviter_user_id,
          name: maskName(r.inviter_first, r.inviter_last),
          mobile: maskMobile(r.inviter_mobile),
          subscription_plan: r.inviter_plan,
        },
        invitee: {
          id: r.invitee_user_id,
          name: maskName(r.invitee_first, r.invitee_last),
          mobile: maskMobile(r.invitee_mobile),
          joined_at: r.invitee_joined,
        },
        inviter_plan_at_signup: r.inviter_plan_at_signup,
        purchase_resulted: purchased,
        inviter_discount_earned: ownDisc ? `${ownDisc.discount_percent}%` : null,
        invitee_discount_applied: inviteeDiscRow ? `${inviteeDiscRow.discount_percent}%` : null,
        created_at: r.created_at,
      };
    });

    return res.json({ referrals });
  } catch (err) {
    console.error('[referral.adminListReferrals] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        ADMIN  GET /api/admin/referrals/stats
// ============================================================

function adminReferralsStats(_req, res) {
  try {
    const totalRow = db.prepare('SELECT COUNT(*) AS cnt FROM referrals').get();
    const successRow = db.prepare(`
      SELECT COUNT(DISTINCT referral_id) AS cnt
        FROM referral_discounts
       WHERE source = 'invitee' AND is_used = 1
    `).get();
    const totalPctRow = db.prepare(`
      SELECT COALESCE(SUM(discount_percent), 0) AS total FROM referral_discounts WHERE is_used = 1
    `).get();
    const topRows = db.prepare(`
      SELECT u.id AS user_id,
             COALESCE(NULLIF(TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')), ''), 'کاربر دخلیار') AS name,
             COUNT(r.id) AS invite_count,
             COALESCE(u.referral_discount_count, 0) AS discount_earned
        FROM users u
        LEFT JOIN referrals r ON r.inviter_user_id = u.id
       GROUP BY u.id
      HAVING invite_count > 0
       ORDER BY invite_count DESC, discount_earned DESC
       LIMIT 10
    `).all();

    return res.json({
      total_referrals: Number(totalRow?.cnt || 0),
      successful_referrals: Number(successRow?.cnt || 0),
      total_discount_given_percent: Number(totalPctRow?.total || 0),
      top_inviters: topRows.map((r) => ({
        user_id: r.user_id,
        name: maskName(...String(r.name || '').split(' ', 2)),
        invite_count: Number(r.invite_count),
        discount_earned: Number(r.discount_earned),
      })),
    });
  } catch (err) {
    console.error('[referral.adminReferralsStats] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// 09120001122 → 0912***1122
function maskMobile(m) {
  if (!m || typeof m !== 'string' || m.length < 7) return '—';
  return m.slice(0, 4) + '***' + m.slice(-4);
}

module.exports = {
  validateCode,
  applyReferral,
  getDiscount,
  myInvites,
  adminListReferrals,
  adminReferralsStats,
  _maskName: maskName, // exposed for tests / Phase 4 admin UI
};
