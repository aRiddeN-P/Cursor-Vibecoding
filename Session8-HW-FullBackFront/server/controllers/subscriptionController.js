/**
 * subscriptionController.js
 * Subscription plans + status + request (admin will approve in Phase 4).
 * Prices are taken from the server-side PLANS constant — the client
 * may never override them.
 */

const fs = require('fs');
const path = require('path');

const db = require('../db/appDb');
const { PLANS, PLAN_RANK, listPlans, getPlan } = require('../utils/plans');
const { isPremiumSeed, DEFAULT_SEED } = require('../utils/avatarHelper');
const messages = require('./messagesController');
const { toPersianDigits, jalaliDate } = require('../utils/timeHelper');
const push = require('../utils/pushHelper');
const {
  getActiveInviteeDiscount,
  getPendingInviterDiscountPercent,
  priceAfterDiscount,
  MAX_INVITER_DISCOUNT_PERCENT,
} = require('../utils/discountHelper');

const AVATAR_UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads', 'avatars');

const stmts = {
  selectUser: db.prepare(
    'SELECT id, subscription_plan, subscription_expires_at FROM users WHERE id = ?'
  ),
  selectPending: db.prepare(`
    SELECT id, plan, duration_months, price, status, admin_note, created_at
    FROM subscription_requests
    WHERE user_id = ? AND status = 'pending'
    ORDER BY id DESC LIMIT 1
  `),
  insertRequest: db.prepare(`
    INSERT INTO subscription_requests (user_id, plan, duration_months, price, status)
    VALUES (?, ?, ?, ?, 'pending')
  `),
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ============================================================
//             GET /api/subscription/plans
// ============================================================

function getPlans(req, res) {
  const plans = listPlans();
  // Authenticated callers also get their current invitee discount (if any),
  // so the UI can render the discounted price on each card. Public callers
  // (e.g. landing/guest preview) still get prices only.
  const userId = req.session && req.session.user_id;
  if (!userId) return res.json({ plans });

  try {
    const invitee = getActiveInviteeDiscount(userId);
    const pendingInviter = getPendingInviterDiscountPercent(userId);

    // Each card carries its OWN final_price so the frontend doesn't have to
    // know the discount math.
    const plansWithDiscount = plans.map((p) => {
      const inviteePct = invitee ? Number(invitee.discount_percent || 0) : 0;
      // For display purposes show the bigger benefit. At purchase time, the
      // admin approval path applies inviter-own discount (which stacks) and
      // takes precedence over the invitee discount on the same request.
      const displayPct = Math.max(inviteePct, pendingInviter);
      return {
        ...p,
        discount_percent: displayPct,
        final_price: displayPct > 0 ? priceAfterDiscount(p.price, displayPct) : null,
      };
    });

    return res.json({
      plans: plansWithDiscount,
      discount: invitee
        ? {
            has_discount: true,
            discount_percent: invitee.discount_percent,
            expires_at: invitee.expires_at,
            source: 'invitee',
          }
        : { has_discount: false },
      pending_inviter_discount_percent: pendingInviter,
      max_inviter_discount_percent: MAX_INVITER_DISCOUNT_PERCENT,
    });
  } catch (err) {
    console.error('[subscription.getPlans] discount lookup failed:', err);
    return res.json({ plans });
  }
}

// ============================================================
//             GET /api/subscription/status
// ============================================================

function getStatus(req, res) {
  try {
    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }
    const pending = stmts.selectPending.get(user.id);
    const plan = user.subscription_plan ? PLANS[user.subscription_plan] : null;
    const days_remaining = daysUntil(user.subscription_expires_at);
    const is_active = Boolean(
      user.subscription_plan && days_remaining !== null && days_remaining > 0
    );

    // Phase 3-C — surface the inviter-side stacked discount so the UI can
    // show "X% آماده استفاده در خرید بعدی".
    let pendingInviterDiscount = 0;
    try {
      pendingInviterDiscount = getPendingInviterDiscountPercent(user.id);
    } catch (_) {}

    return res.json({
      plan: user.subscription_plan || null,
      plan_name: plan ? plan.name : null,
      expires_at: user.subscription_expires_at || null,
      is_active,
      days_remaining: is_active ? days_remaining : null,
      pending_request: pending || null,
      pending_inviter_discounts: pendingInviterDiscount,
    });
  } catch (err) {
    console.error('[subscription.getStatus] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//             POST /api/subscription/request
// ============================================================

function postRequest(req, res) {
  try {
    const planKey = (req.body || {}).plan;
    const plan = getPlan(planKey);
    if (!plan) {
      return res.status(400).json({ message: 'پلن انتخابی معتبر نیست' });
    }

    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    const pending = stmts.selectPending.get(user.id);
    if (pending) {
      return res
        .status(409)
        .json({ message: 'یک درخواست اشتراک در حال بررسی دارید', pending });
    }

    // Warn (but don't block) if user already has equal or higher active plan.
    let warning = null;
    if (user.subscription_plan && PLAN_RANK[user.subscription_plan] >= PLAN_RANK[planKey]) {
      warning = `شما در حال حاضر یک اشتراک فعال یا بالاتر دارید (${PLANS[user.subscription_plan].name}).`;
    }

    const info = stmts.insertRequest.run(
      user.id,
      plan.key,
      plan.duration_months,
      plan.price
    );
    const requestId = Number(info.lastInsertRowid);

    // Phase 3-D — request message that will later get upserted into a
    // result message when admin approves/rejects.
    try {
      const priceFa = toPersianDigits(Number(plan.price).toLocaleString('en-US'));
      messages.insertMessage({
        userId: user.id,
        title: `درخواست اشتراک ${plan.name}`,
        body: `درخواست خرید اشتراک ${plan.name} (${plan.label}) به مبلغ ${priceFa} تومان ثبت شد و در انتظار تایید است.`,
        type: 'subscription_request',
        relatedId: requestId,
        expiresAt: null,
      });
    } catch (msgErr) {
      console.error('[subscription.postRequest] message insert failed:', msgErr);
    }

    return res.json({
      success: true,
      message: 'درخواست اشتراک ثبت شد و در انتظار تایید ادمین است',
      request_id: requestId,
      warning,
    });
  } catch (err) {
    console.error('[subscription.postRequest] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//      Subscription expiry → revert avatar/state (helper)
// ============================================================

const expiryStmts = {
  selectExpired: db.prepare(`
    SELECT id, subscription_plan, subscription_expires_at,
           avatar_type, avatar_seed, avatar_custom_path, avatar_last_seed
      FROM users
     WHERE subscription_plan IS NOT NULL
       AND subscription_expires_at IS NOT NULL
       AND date(subscription_expires_at) < date('now')
  `),
  selectOneExpired: db.prepare(`
    SELECT id, subscription_plan, subscription_expires_at,
           avatar_type, avatar_seed, avatar_custom_path, avatar_last_seed
      FROM users
     WHERE id = ?
       AND subscription_plan IS NOT NULL
       AND subscription_expires_at IS NOT NULL
       AND date(subscription_expires_at) < date('now')
  `),
  revertCustom: db.prepare(`
    UPDATE users
       SET avatar_type = 'dicebear',
           avatar_custom_path = NULL,
           avatar_seed = ?,
           avatar_last_seed = ?,
           subscription_plan = NULL,
           subscription_expires_at = NULL
     WHERE id = ?
  `),
  revertPremiumSeed: db.prepare(`
    UPDATE users
       SET avatar_seed = ?,
           avatar_last_seed = ?,
           subscription_plan = NULL,
           subscription_expires_at = NULL
     WHERE id = ?
  `),
  clearSubOnly: db.prepare(`
    UPDATE users
       SET subscription_plan = NULL,
           subscription_expires_at = NULL
     WHERE id = ?
  `),
  // Pick users whose subscription expires within a (from, to] day window
  // (relative to now), inclusive on the upper bound — matches the spec's
  // "BETWEEN datetime('now','+(N-1) days') AND datetime('now','+N days')".
  selectExpiringInRange: db.prepare(`
    SELECT id, subscription_plan, subscription_expires_at
      FROM users
     WHERE subscription_plan IS NOT NULL
       AND subscription_expires_at IS NOT NULL
       AND datetime(subscription_expires_at) >  datetime('now', '+' || ? || ' days')
       AND datetime(subscription_expires_at) <= datetime('now', '+' || ? || ' days')
  `),
};

function _safeDeleteAvatarFile(relPath) {
  if (!relPath) return;
  try {
    const filename = path.basename(relPath);
    const abs = path.join(AVATAR_UPLOADS_DIR, filename);
    if (abs.startsWith(AVATAR_UPLOADS_DIR) && fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  } catch (err) {
    console.warn('[expiry] failed to delete avatar file', relPath, err.message);
  }
}

/**
 * Detect users whose subscription has expired and clean them up:
 *   - Custom photo  → file deleted, avatar reverted to last (non-premium) seed
 *   - Premium seed  → reverted to last (non-premium) seed
 *   - Free seed     → unchanged (just subscription columns cleared)
 *
 * Notifications are inserted in the same transaction so the user always
 * sees them right after expiry.
 *
 * @param {?number} specificUserId  if provided, only this user is processed;
 *                                  otherwise the entire table is scanned.
 * @returns {number} number of users processed
 */
function checkAndRevertExpiredSubscriptions(specificUserId = null) {
  try {
    const expired = specificUserId
      ? [expiryStmts.selectOneExpired.get(specificUserId)].filter(Boolean)
      : expiryStmts.selectExpired.all();

    if (!expired.length) return 0;

    const expiredInfo = []; // collected for post-tx message inserts

    const tx = db.transaction((rows) => {
      for (const u of rows) {
        const planKey = u.subscription_plan;
        const planName = PLANS[planKey] ? PLANS[planKey].name : (planKey || 'اشتراک');

        // Decide the safe seed to fall back to. Premium seeds are not allowed
        // for users without an active subscription, so swap to DEFAULT_SEED.
        let newSeed = u.avatar_last_seed || u.avatar_seed || DEFAULT_SEED;
        if (isPremiumSeed(newSeed)) newSeed = DEFAULT_SEED;

        if (u.avatar_type === 'custom') {
          _safeDeleteAvatarFile(u.avatar_custom_path);
          expiryStmts.revertCustom.run(newSeed, newSeed, u.id);
        } else if (u.avatar_type === 'dicebear' && isPremiumSeed(u.avatar_seed)) {
          expiryStmts.revertPremiumSeed.run(newSeed, newSeed, u.id);
        } else {
          expiryStmts.clearSubOnly.run(u.id);
        }
        expiredInfo.push({ userId: u.id, planName });
      }
    });
    tx(expired);

    // Phase 3-D — write the user-facing "subscription expired" message
    // OUTSIDE the avatar/sub-update tx so a message insert hiccup never
    // rolls back the actual reversion.
    for (const info of expiredInfo) {
      let msgId = null;
      try {
        msgId = messages.insertMessage({
          userId: info.userId,
          title: 'اشتراک شما به پایان رسید',
          body: `اشتراک ${info.planName} شما منقضی شده است. برای استفاده از امکانات ویژه، اشتراک خود را تمدید کنید.`,
          type: 'subscription_expired',
          relatedId: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      } catch (msgErr) {
        console.error('[expiry] message insert failed:', msgErr);
      }
      // Phase 3-F — fire-and-forget Web Push.
      push.sendPushAsync(info.userId, {
        title: 'اشتراک شما منقضی شد',
        body: 'برای استفاده از امکانات ویژه اشتراک تمدید کنید',
        tag: 'sub-expired-' + info.userId,
        url: '/messages.html',
        message_id: msgId,
      });
    }

    if (!specificUserId) {
      console.log(`[expiry] cleaned up ${expired.length} expired subscription(s)`);
    }
    return expired.length;
  } catch (err) {
    console.error('[expiry] checkAndRevertExpiredSubscriptions error:', err);
    return 0;
  }
}

/**
 * Phase 3-D — sends "X days left" warnings for upcoming subscription expiry.
 * Called by the periodic scheduler in server/index.js.
 *
 * For each of (10, 5, 1) days remaining we:
 *   1. find users whose `subscription_expires_at` falls inside [now+(N-1)d, now+Nd)
 *   2. for each, dedup against any existing 'subscription_expiry_warning' that
 *      contains "N روز" in the body and is younger than 2 days
 *   3. insert a fresh warning whose own expires_at = subscription_expires_at
 *
 * Returns the number of warnings actually inserted.
 */
function sendUpcomingExpiryWarnings() {
  let inserted = 0;
  try {
    const windows = [
      { n: 10, label: '۱۰ روز' },
      { n: 5,  label: '۵ روز' },
      { n: 1,  label: '۱ روز' },
    ];
    for (const w of windows) {
      const candidates = expiryStmts.selectExpiringInRange.all(w.n - 1, w.n);
      for (const u of candidates) {
        const planKey = u.subscription_plan;
        const planName = PLANS[planKey] ? PLANS[planKey].name : (planKey || 'اشتراک');
        // body needle for dedup: e.g. "۱۰ روز", "۵ روز", "۱ روز"
        const id = messages.insertDedupedMessage({
          userId: u.id,
          type: 'subscription_expiry_warning',
          bodyLikePattern: `%${w.label}%`,
          title: 'اشتراک شما رو به پایان است',
          body: `${w.label} تا پایان اشتراک ${planName} شما باقی مانده است. برای تمدید اقدام کنید.`,
          relatedId: null,
          expiresAt: u.subscription_expires_at, // disappear when the sub does
        });
        if (id) {
          inserted += 1;
          // Phase 3-F — Web Push only when a new message was actually
          // inserted (dedup-respecting). Tag prevents OS-level dupes too.
          const isLastDay = w.n === 1;
          push.sendPushAsync(u.id, {
            title: isLastDay
              ? 'فردا اشتراک شما تمام می‌شود!'
              : 'اشتراک شما رو به پایان است',
            body: isLastDay
              ? 'آخرین فرصت برای تمدید اشتراک'
              : `${w.label} تا پایان اشتراک باقی مانده`,
            tag: `sub-expiry-${w.n}d-${u.id}`,
            requireInteraction: isLastDay,
            url: '/messages.html',
            message_id: id,
          });
        }
      }
    }
  } catch (err) {
    console.error('[expiry-warnings] error:', err);
  }
  return inserted;
}

module.exports = {
  getPlans,
  getStatus,
  postRequest,
  checkAndRevertExpiredSubscriptions,
  sendUpcomingExpiryWarnings,
};
