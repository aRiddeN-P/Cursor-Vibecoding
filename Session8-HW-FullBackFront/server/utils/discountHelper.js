/**
 * discountHelper.js — Phase 3-C (Referral / Invite system)
 *
 * Single source of truth for referral discount rules. Numbers below are taken
 * from the product spec and must never be overridden by the client.
 *
 *   Inviter plan │ Inviter % (on EACH referral purchase, NO expiry)
 *   ─────────────┼─────────────────────────────────────────────────
 *     silver     │ 1 %
 *     gold       │ 2 %
 *     diamond    │ 5 %
 *     (no sub)   │ 0 %   ← referral relationship still recorded
 *
 *   Inviter plan │ Invitee % (one-time, valid 10 days from signup)
 *   ─────────────┼─────────────────────────────────────────────────
 *     silver     │ 2 %
 *     gold       │ 5 %
 *     diamond    │ 10 %
 *     (no sub)   │ 0 %
 *
 * Inviter discount cap: 5 successful referrals total (users.referral_discount_count).
 * Inviter's own unused discounts STACK and can be redeemed on their next purchase
 * (capped at MAX_INVITER_DISCOUNT_PERCENT to keep the math sane).
 *
 * This module performs side effects on the app database directly. The exported
 * functions are designed to be called from inside an existing transaction (e.g.
 * adminReviewController.approveSubscription) — we never start our own outer tx
 * to avoid nesting and to keep "approve subscription" atomic with the discount
 * bookkeeping & notifications.
 */

const db = require('../db/appDb');
const { PLANS } = require('./plans');
// Lazy-require to dodge a circular dep risk between discountHelper ↔ messagesController
// (messagesController doesn't import discountHelper today, but defer just in case).
function _messages() {
  return require('../controllers/messagesController');
}
// Same trick for pushHelper — we never want to crash the discount pipeline
// because the push module misloaded.
function _push() {
  try { return require('./pushHelper'); }
  catch (_) { return { sendPushAsync: () => {} }; }
}

// ─────────────────────────── Constants ──────────────────────────────────────

const INVITER_DISCOUNT_BY_PLAN = Object.freeze({
  silver:  1,
  gold:    2,
  diamond: 5,
});

const INVITEE_DISCOUNT_BY_PLAN = Object.freeze({
  silver:  2,
  gold:    5,
  diamond: 10,
});

const INVITEE_WINDOW_DAYS = 10;
const MAX_INVITER_REFERRAL_COUNT = 5;
const MAX_INVITER_DISCOUNT_PERCENT = 50; // hard cap when stacking unused inviter discounts

// ─────────────────────────── Prepared statements ────────────────────────────

const stmts = {
  selectUser: db.prepare(
    `SELECT id, mobile, email, first_name, last_name,
            subscription_plan, subscription_expires_at,
            referred_by_code, referral_discount_count, created_at
       FROM users WHERE id = ?`
  ),
  findReferralByInvitee: db.prepare(
    'SELECT * FROM referrals WHERE invitee_user_id = ?'
  ),
  findInviteeDiscount: db.prepare(`
    SELECT * FROM referral_discounts
     WHERE user_id = ?
       AND source = 'invitee'
       AND is_used = 0
       AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
     ORDER BY id DESC
     LIMIT 1
  `),
  inviteeDiscountForReferral: db.prepare(`
    SELECT 1 FROM referral_discounts
     WHERE referral_id = ? AND source = 'invitee'
     LIMIT 1
  `),
  insertInviteeDiscount: db.prepare(`
    INSERT INTO referral_discounts
      (user_id, source, discount_percent, referral_id, expires_at)
    VALUES (?, 'invitee', ?, ?, ?)
  `),
  markDiscountUsed: db.prepare(`
    UPDATE referral_discounts
       SET is_used = 1,
           used_at = CURRENT_TIMESTAMP,
           triggered_by_subscription_request_id = ?
     WHERE id = ?
  `),
  insertInviterDiscount: db.prepare(`
    INSERT INTO referral_discounts
      (user_id, source, discount_percent, referral_id, triggered_by_subscription_request_id, expires_at)
    VALUES (?, 'inviter', ?, ?, ?, NULL)
  `),
  bumpInviterCount: db.prepare(
    'UPDATE users SET referral_discount_count = COALESCE(referral_discount_count, 0) + 1 WHERE id = ?'
  ),
  updateSubFinalPrice: db.prepare(
    'UPDATE subscription_requests SET final_price = ? WHERE id = ?'
  ),
  listUnusedInviterDiscounts: db.prepare(`
    SELECT id, discount_percent FROM referral_discounts
     WHERE user_id = ?
       AND source = 'inviter'
       AND is_used = 0
       AND expires_at IS NULL
     ORDER BY id ASC
  `),
  pendingInviterDiscountSum: db.prepare(`
    SELECT COALESCE(SUM(discount_percent), 0) AS total
      FROM referral_discounts
     WHERE user_id = ?
       AND source = 'inviter'
       AND is_used = 0
  `),
};

// ─────────────────────────── Internal helpers ───────────────────────────────

function hasActiveSubscription(user) {
  if (!user || !user.subscription_plan || !user.subscription_expires_at) return false;
  const t = new Date(user.subscription_expires_at).getTime();
  return !Number.isNaN(t) && t > Date.now();
}

function inviterDiscountPercentFor(planKey) {
  return INVITER_DISCOUNT_BY_PLAN[planKey] || 0;
}

function inviteeDiscountPercentFor(planKey) {
  return INVITEE_DISCOUNT_BY_PLAN[planKey] || 0;
}

/** Round to 2 decimals to avoid float-printing artefacts in money math. */
function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

function priceAfterDiscount(originalPrice, percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  // Subscriptions are integer toman amounts in this codebase; floor to keep cents off.
  return Math.max(0, Math.floor(Number(originalPrice) * (1 - p / 100)));
}

function faPct(n) {
  return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

// ─────────────────────────── Pure (exported) helpers ────────────────────────

/**
 * Called when an invitee registers and applies their inviter's code.
 * Decides whether an invitee-discount entitlement should be CREATED at signup
 * time (it must be — invitee window is 10 days from signup regardless of when
 * the inviter purchased, and the percent is locked-in based on the inviter's
 * plan AT THE MOMENT THE INVITEE SIGNED UP).
 *
 * @param {object} invitee     freshly-fetched user row (must have id, created_at)
 * @param {object} inviter     freshly-fetched user row
 * @param {number} referralId  PK of the referrals row we just inserted
 * @returns {?number} discount_percent if a record was created, else null
 */
function maybeCreateInviteeDiscount(invitee, inviter, referralId) {
  if (!inviter || !invitee || !referralId) return null;
  if (!hasActiveSubscription(inviter)) return null;

  const percent = inviteeDiscountPercentFor(inviter.subscription_plan);
  if (!percent) return null;

  // Window: invitee.created_at + 10 days (DB time is UTC ISO).
  const signupTs = invitee.created_at
    ? new Date(invitee.created_at.replace(' ', 'T') + (invitee.created_at.includes('T') ? '' : 'Z')).getTime()
    : Date.now();
  const expiresAt = new Date(signupTs + INVITEE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');

  // Idempotent — never insert two invitee discounts for the same referral.
  if (stmts.inviteeDiscountForReferral.get(referralId)) return null;

  stmts.insertInviteeDiscount.run(invitee.id, percent, referralId, expiresAt);
  return percent;
}

/**
 * Return the active unused invitee discount for `userId`, if any.
 * Used by the `/api/referral/discount` endpoint and the subscription plans
 * card so the UI can show the discounted price up-front.
 *
 * The inviter must still have an active subscription for this discount to be
 * honored at purchase time, but for display we honor the locked-in percent;
 * we recompute strictly at approval time in `processReferralOnSubscriptionApproval`.
 */
function getActiveInviteeDiscount(userId) {
  const row = stmts.findInviteeDiscount.get(userId);
  if (!row) return null;
  return {
    id: row.id,
    discount_percent: row.discount_percent,
    expires_at: row.expires_at,
    referral_id: row.referral_id,
    source: 'invitee',
  };
}

/** Sum of unused inviter discounts (for the "pile up for next purchase" UX). */
function getPendingInviterDiscountPercent(userId) {
  const row = stmts.pendingInviterDiscountSum.get(userId);
  const total = Number(row?.total || 0);
  return Math.min(MAX_INVITER_DISCOUNT_PERCENT, round2(total));
}

// ─────────────────────────── MAIN APPROVAL HOOK ─────────────────────────────

/**
 * Called from adminReviewController.approveSubscription INSIDE the same
 * transaction that flips the subscription_request to 'approved' and activates
 * the user's subscription.
 *
 * Side effects (in this order):
 *   1) If the approved user is an invitee with an unused, in-window invitee
 *      discount AND the inviter still had an active subscription at apply-time
 *      → mark that discount as used, write `final_price` on the subscription
 *      request, queue a notification for the invitee.
 *   2) If the approved user is an invitee → credit a NEW inviter-side discount
 *      to the inviter, subject to the 5-referral cap and the inviter currently
 *      having an active subscription. Queue a notification for the inviter.
 *   3) If the approved user HAS unused inviter-side discounts of their own,
 *      apply them to their own purchase (this lets inviters cash in their
 *      accumulated rewards). Marked used, final_price overwrites the value
 *      from step 1 if both fire on the same request.
 *
 * @param {object} subscriptionRequest  the row from subscription_requests
 *                                      (must include id, user_id, plan, price)
 * @returns {{
 *   invitee_discount_percent: number,
 *   inviter_discount_percent: number,
 *   inviter_own_discount_percent: number,
 *   final_price: ?number
 * }}
 */
function processReferralOnSubscriptionApproval(subscriptionRequest /* , _appDb */) {
  const result = {
    invitee_discount_percent: 0,
    inviter_discount_percent: 0,
    inviter_own_discount_percent: 0,
    final_price: null,
  };
  if (!subscriptionRequest || !subscriptionRequest.id) return result;

  const invitee = stmts.selectUser.get(subscriptionRequest.user_id);
  if (!invitee) return result;

  const plan = PLANS[subscriptionRequest.plan];
  const originalPrice = Number(subscriptionRequest.price || plan?.price || 0);
  let currentFinal = originalPrice;
  let priceChanged = false;

  // ─── (1) INVITEE DISCOUNT — on the user being approved ────────────────────
  let inviterRow = null;
  if (invitee.referred_by_code) {
    const referral = stmts.findReferralByInvitee.get(invitee.id);
    if (referral) {
      inviterRow = stmts.selectUser.get(referral.inviter_user_id);

      const discount = stmts.findInviteeDiscount.get(invitee.id);
      // Honor the discount only when the inviter had an active subscription
      // AT THE TIME THE INVITEE SIGNED UP (the policy locks in then).
      if (discount && referral.inviter_plan_at_signup) {
        stmts.markDiscountUsed.run(subscriptionRequest.id, discount.id);
        currentFinal = priceAfterDiscount(currentFinal, discount.discount_percent);
        priceChanged = true;
        result.invitee_discount_percent = discount.discount_percent;

        try {
          _messages().insertMessage({
            userId: invitee.id,
            title: 'تخفیف کد دعوت اعمال شد',
            body: `کد دعوت شما اعمال شد! ${faPct(discount.discount_percent)}٪ تخفیف در این خرید لحاظ شد.`,
            type: 'referral',
            relatedId: null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
        } catch (msgErr) {
          console.error('[discountHelper] invitee-discount-applied message failed:', msgErr);
        }
      }

      // ─── (2) INVITER REWARD — credit the inviter for a successful referral ─
      if (inviterRow) {
        const inviterCount = Number(inviterRow.referral_discount_count || 0);
        const inviterActive = hasActiveSubscription(inviterRow);
        if (inviterActive && inviterCount < MAX_INVITER_REFERRAL_COUNT) {
          const pct = inviterDiscountPercentFor(inviterRow.subscription_plan);
          if (pct > 0) {
            stmts.insertInviterDiscount.run(
              inviterRow.id,
              pct,
              referral.id,
              subscriptionRequest.id
            );
            stmts.bumpInviterCount.run(inviterRow.id);
            result.inviter_discount_percent = pct;

            // Phase 3-D — cap-aware message ("inviter just hit the 5-cap"
            // vs "discount added to your next purchase").
            const newCount = inviterCount + 1;
            const capHit = newCount >= MAX_INVITER_REFERRAL_COUNT;
            const body = capHit
              ? 'دعوت‌شده شما اشتراک خرید. سقف ۵ تخفیف دعوت شما تکمیل شده است.'
              : `دعوت‌شده شما اشتراک خرید. ${faPct(pct)}٪ تخفیف برای خرید بعدی اشتراک به حساب شما اضافه شد.`;
            let inviterMsgId = null;
            try {
              inviterMsgId = _messages().insertMessage({
                userId: inviterRow.id,
                title: 'تخفیف دعوت اضافه شد',
                body,
                type: 'referral',
                relatedId: referral.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              });
            } catch (msgErr) {
              console.error('[discountHelper] inviter-discount-added message failed:', msgErr);
            }

            // Phase 3-F — Web Push to inviter.
            _push().sendPushAsync(inviterRow.id, {
              title: 'تخفیف دعوت اضافه شد',
              body: capHit
                ? 'دعوت‌شده شما اشتراک خرید. سقف تخفیف‌های دعوت شما تکمیل شد.'
                : `${faPct(pct)}٪ تخفیف برای خرید بعدی به حساب شما اضافه شد.`,
              tag: 'referral-purchased-' + referral.id,
              url: '/messages.html',
              message_id: inviterMsgId,
            });
          }
        }
      }
    }
  }

  // ─── (3) INVITER'S OWN STACKED DISCOUNTS — when THEY purchase ─────────────
  // (Independent of whether the approved user was invited by anyone.)
  const own = applyInviterDiscountsToOwnPurchase(invitee.id, subscriptionRequest.id, originalPrice);
  if (own.percent > 0) {
    // own price calc takes precedence (it's the FULL stacked benefit)
    currentFinal = own.final_price;
    priceChanged = true;
    result.inviter_own_discount_percent = own.percent;
  }

  if (priceChanged) {
    stmts.updateSubFinalPrice.run(currentFinal, subscriptionRequest.id);
    result.final_price = currentFinal;
  }

  return result;
}

/**
 * Redeem ALL of `userId`'s unused inviter discounts against
 * `subscriptionRequestId`. Capped at MAX_INVITER_DISCOUNT_PERCENT total.
 *
 * Discounts beyond the cap are kept unused for the next purchase.
 *
 * Returns: { percent: number, final_price: number, used_ids: number[] }
 */
function applyInviterDiscountsToOwnPurchase(userId, subscriptionRequestId, originalPrice) {
  const rows = stmts.listUnusedInviterDiscounts.all(userId);
  if (!rows.length) return { percent: 0, final_price: originalPrice, used_ids: [] };

  let total = 0;
  const usedIds = [];
  for (const r of rows) {
    if (total + r.discount_percent > MAX_INVITER_DISCOUNT_PERCENT) break;
    total = round2(total + r.discount_percent);
    usedIds.push(r.id);
  }
  if (!usedIds.length) return { percent: 0, final_price: originalPrice, used_ids: [] };

  for (const id of usedIds) {
    stmts.markDiscountUsed.run(subscriptionRequestId, id);
  }
  return {
    percent: total,
    final_price: priceAfterDiscount(originalPrice, total),
    used_ids: usedIds,
  };
}

// ─────────────────────────── Phase 3-D — invitee-discount expiry warnings ──

/**
 * checkReferralDiscountExpiry — periodic scheduler hook (called from
 * server/index.js setInterval). Sends "3 روز" and "1 روز" warning messages
 * before an unused invitee discount expires.
 *
 * Returns the number of warning messages inserted (after dedup).
 */
const _expiringStmts = {
  // Unused invitee discounts whose expires_at falls in (now+(N-1)d, now+Nd]
  // (inclusive on the upper bound). Uses datetime() for sub-day precision.
  selectInRange: db.prepare(`
    SELECT id, user_id, discount_percent, expires_at
      FROM referral_discounts
     WHERE source = 'invitee'
       AND is_used = 0
       AND expires_at IS NOT NULL
       AND datetime(expires_at) >  datetime('now', '+' || ? || ' days')
       AND datetime(expires_at) <= datetime('now', '+' || ? || ' days')
  `),
};

function checkReferralDiscountExpiry() {
  let inserted = 0;
  const msgs = _messages();
  const windows = [
    { n: 3, label: '۳ روز' },
    { n: 1, label: '۱ روز' },
  ];
  for (const w of windows) {
    try {
      const rows = _expiringStmts.selectInRange.all(w.n - 1, w.n);
      for (const r of rows) {
        const pctLabel = faPct(r.discount_percent);
        const body =
          w.n === 1
            ? `فقط ۱ روز تا پایان تخفیف ${pctLabel}٪ کد دعوت شما باقی مانده است. فرصت را از دست ندهید!`
            : `${w.label} تا پایان تخفیف ${pctLabel}٪ کد دعوت شما باقی مانده است. همین حالا اشتراک تهیه کنید.`;
        try {
          const id = msgs.insertDedupedMessage({
            userId: r.user_id,
            type: 'referral',
            bodyLikePattern: `%${w.label}%`,
            title: 'تخفیف دعوت شما رو به پایان است',
            body,
            relatedId: null,
            expiresAt: r.expires_at,
          });
          if (id) inserted += 1;
        } catch (msgErr) {
          console.error('[checkReferralDiscountExpiry] insert failed:', msgErr);
        }
      }
    } catch (err) {
      console.error(`[checkReferralDiscountExpiry] window ${w.n}d failed:`, err);
    }
  }
  return inserted;
}

// ─────────────────────────── Exports ────────────────────────────────────────

module.exports = {
  processReferralOnSubscriptionApproval,
  applyInviterDiscountsToOwnPurchase,
  maybeCreateInviteeDiscount,
  getActiveInviteeDiscount,
  getPendingInviterDiscountPercent,
  checkReferralDiscountExpiry,

  // helpers + constants exposed for the referralController / admin & tests
  INVITER_DISCOUNT_BY_PLAN,
  INVITEE_DISCOUNT_BY_PLAN,
  INVITEE_WINDOW_DAYS,
  MAX_INVITER_REFERRAL_COUNT,
  MAX_INVITER_DISCOUNT_PERCENT,
  hasActiveSubscription,
  inviterDiscountPercentFor,
  inviteeDiscountPercentFor,
  priceAfterDiscount,
};
