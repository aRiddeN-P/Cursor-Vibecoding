/**
 * routes/referral.js — Phase 3-C
 * Mounted under /api/referral by server/index.js.
 *
 * Public routes (no auth):
 *   GET  /validate/:code   — pre-signup lookup
 *   POST /apply            — post-register, pre-login link to inviter
 *
 * Authenticated routes:
 *   GET  /discount         — invitee's current usable discount
 *   GET  /my-invites       — inviter dashboard (codes + earned discounts)
 */

const express = require('express');
const ctrl = require('../controllers/referralController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();

router.get('/validate/:code', ctrl.validateCode);   // public
router.post('/apply',         ctrl.applyReferral);  // public
router.get('/discount',       requireUser, ctrl.getDiscount);
router.get('/my-invites',     requireUser, ctrl.myInvites);

module.exports = router;
