'use strict';

const { pingSession } = require('../utils/sessionHelper');

function ping(req, res) {
  try {
    pingSession(req.session.user_id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[session.ping]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = { ping };
