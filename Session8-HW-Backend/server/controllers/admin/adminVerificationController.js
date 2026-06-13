'use strict';

const appDb = require('../../db/appDb');
const messages = require('../messagesController');
const push = require('../../utils/pushHelper');
const { toPersianDigits, jalaliDate } = require('../../utils/timeHelper');
const { logActivity, getClientIp } = require('./adminAuthController');

function faDigit(n) {
  return toPersianDigits(n);
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
      where.push('vr.status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { total } = appDb.prepare(
      `SELECT COUNT(*) AS total FROM verification_requests vr ${whereSql}`
    ).get(...params);

    const rows = appDb.prepare(`
      SELECT vr.id, vr.requested_level, vr.status, vr.admin_note,
             vr.created_at, vr.reviewed_at,
             u.id AS user_id, u.mobile, u.email, u.first_name, u.last_name,
             u.verification_level
      FROM verification_requests vr
      JOIN users u ON u.id = vr.user_id
      ${whereSql}
      ORDER BY (vr.status = 'pending') DESC, vr.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const requests = rows.map((r) => ({
      id: r.id,
      requested_level: r.requested_level,
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
        verification_level: r.verification_level,
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
    console.error('[adminVerification.listRequests]', err);
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

    const reqRow = appDb.prepare('SELECT * FROM verification_requests WHERE id = ?').get(id);
    if (!reqRow) return res.status(404).json({ message: 'درخواست یافت نشد' });
    if (reqRow.status !== 'pending') {
      return res.status(400).json({ message: 'این درخواست قبلاً بررسی شده است' });
    }

    const user = appDb.prepare(
      'SELECT id, verification_level FROM users WHERE id = ?'
    ).get(reqRow.user_id);
    if (!user) return res.status(404).json({ message: 'کاربر یافت نشد' });

    if (action === 'approve') {
      const target = reqRow.requested_level;
      if (target !== user.verification_level + 1) {
        return res.status(409).json({
          message: `سطح فعلی کاربر ${faDigit(user.verification_level)} است؛ نمی‌توان مستقیماً به سطح ${faDigit(target)} ارتقاء داد`,
        });
      }

      let pushMsgId = null;
      const tx = appDb.transaction(() => {
        appDb.prepare('UPDATE users SET verification_level = ? WHERE id = ?').run(
          target,
          reqRow.user_id
        );
        appDb.prepare(
          "UPDATE verification_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, admin_note = ? WHERE id = ?"
        ).run(note, id);
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
          console.error('[adminVerification.approve] message failed:', msgErr);
        }
      });
      tx();

      push.sendPushAsync(reqRow.user_id, {
        title: `احراز سطح ${faDigit(target)} تایید شد ✓`,
        body: 'درخواست ارتقاء سطح احراز هویت شما تایید شد.',
        tag: 'verification-result-' + id,
        url: '/messages.html',
        message_id: pushMsgId,
      });

      logActivity(req.session.adminId, 'approve_verification', {
        target_type: 'user',
        target_id: reqRow.user_id,
        ip: getClientIp(req),
        detail: { request_id: id, level: target },
      });
    } else {
      let pushMsgId = null;
      const tx = appDb.transaction(() => {
        appDb.prepare(
          "UPDATE verification_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, admin_note = ? WHERE id = ?"
        ).run(note, id);
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
          console.error('[adminVerification.reject] message failed:', msgErr);
        }
      });
      tx();

      push.sendPushAsync(reqRow.user_id, {
        title: `درخواست احراز سطح ${faDigit(reqRow.requested_level)} رد شد`,
        body: 'درخواست احراز هویت شما رد شد.',
        tag: 'verification-result-' + id,
        url: '/messages.html',
        message_id: pushMsgId,
      });

      logActivity(req.session.adminId, 'reject_verification', {
        target_type: 'user',
        target_id: reqRow.user_id,
        ip: getClientIp(req),
        detail: { request_id: id },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[adminVerification.patchRequest]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = { listRequests, patchRequest };
