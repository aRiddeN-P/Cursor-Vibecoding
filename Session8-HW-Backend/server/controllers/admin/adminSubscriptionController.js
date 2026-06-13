'use strict';

const appDb = require('../../db/appDb');
const messages = require('../messagesController');
const push = require('../../utils/pushHelper');
const { PLANS } = require('../../utils/plans');
const { processReferralOnSubscriptionApproval } = require('../../utils/discountHelper');
const { toPersianDigits, jalaliDate } = require('../../utils/timeHelper');
const { logActivity, getClientIp } = require('./adminAuthController');

function addMonthsIso(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

function parsePageLimit(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

function listRequests(req, res) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query);
    const status = req.query.status || 'pending';
    const where = [];
    const params = [];

    if (status !== 'all') {
      where.push('sr.status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { total } = appDb.prepare(
      `SELECT COUNT(*) AS total FROM subscription_requests sr ${whereSql}`
    ).get(...params);

    const rows = appDb.prepare(`
      SELECT sr.id, sr.plan, sr.duration_months, sr.price, sr.final_price,
             sr.status, sr.admin_note, sr.created_at, sr.reviewed_at,
             u.id AS user_id, u.mobile, u.email, u.first_name, u.last_name,
             u.subscription_plan
      FROM subscription_requests sr
      JOIN users u ON u.id = sr.user_id
      ${whereSql}
      ORDER BY (sr.status = 'pending') DESC, sr.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const requests = rows.map((r) => ({
      id: r.id,
      plan: r.plan,
      duration_months: r.duration_months,
      price: r.price,
      final_price: r.final_price,
      status: r.status,
      admin_note: r.admin_note,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
      user: {
        id: r.user_id,
        mobile: r.mobile,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        subscription_plan: r.subscription_plan,
      },
    }));

    return res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (err) {
    console.error('[adminSubscription.listRequests]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function patchRequest(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'شناسه نامعتبر است' });
    }

    const { action, admin_note: noteRaw } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'عملیات نامعتبر است' });
    }
    const note =
      typeof noteRaw === 'string' ? noteRaw.trim().slice(0, 500) || null : null;

    const reqRow = appDb.prepare('SELECT * FROM subscription_requests WHERE id = ?').get(id);
    if (!reqRow) return res.status(404).json({ message: 'درخواست یافت نشد' });
    if (reqRow.status !== 'pending') {
      return res.status(400).json({ message: 'این درخواست قبلاً بررسی شده است' });
    }

    if (action === 'approve') {
      const plan = PLANS[reqRow.plan];
      if (!plan) return res.status(400).json({ message: 'پلن این درخواست در سرور معتبر نیست' });

      const expiresAt = addMonthsIso(plan.duration_months);
      let pushMsgId = null;

      const tx = appDb.transaction(() => {
        appDb.prepare(
          'UPDATE users SET subscription_plan = ?, subscription_expires_at = ? WHERE id = ?'
        ).run(plan.key, expiresAt, reqRow.user_id);
        appDb.prepare(
          "UPDATE subscription_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, admin_note = ? WHERE id = ?"
        ).run(note, id);
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
          console.error('[adminSubscription.approve] message failed:', msgErr);
        }
        try {
          processReferralOnSubscriptionApproval(reqRow);
        } catch (refErr) {
          console.error('[adminSubscription.approve] referral failed:', refErr);
        }
      });
      tx();

      push.sendPushAsync(reqRow.user_id, {
        title: `اشتراک ${plan.name} فعال شد ✓`,
        body: 'اشتراک شما با موفقیت فعال شد.',
        tag: 'subscription-result-' + id,
        requireInteraction: true,
        url: '/messages.html',
        message_id: pushMsgId,
      });

      logActivity(req.session.adminId, 'approve_subscription', {
        target_type: 'user',
        target_id: reqRow.user_id,
        ip: getClientIp(req),
        detail: { request_id: id, plan: plan.key },
      });
    } else {
      const planName = PLANS[reqRow.plan] ? PLANS[reqRow.plan].name : reqRow.plan;
      let pushMsgId = null;

      const tx = appDb.transaction(() => {
        appDb.prepare(
          "UPDATE subscription_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, admin_note = ? WHERE id = ?"
        ).run(note, id);
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
          console.error('[adminSubscription.reject] message failed:', msgErr);
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

      logActivity(req.session.adminId, 'reject_subscription', {
        target_type: 'user',
        target_id: reqRow.user_id,
        ip: getClientIp(req),
        detail: { request_id: id },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[adminSubscription.patchRequest]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = { listRequests, patchRequest };
