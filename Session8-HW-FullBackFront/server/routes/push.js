/**
 * routes/push.js — Phase 3-F
 * Mounted under /api/push by server/index.js.
 *
 *   GET    /vapid-public-key   → public
 *   POST   /subscribe          → session required
 *   DELETE /unsubscribe        → session required
 */
'use strict';

const express = require('express');
const ctrl = require('../controllers/pushController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();

router.get('/vapid-public-key', ctrl.getVapidPublicKey);
router.post('/subscribe',       requireUser, ctrl.subscribe);
router.delete('/unsubscribe',   requireUser, ctrl.unsubscribe);

module.exports = router;
