/**
 * routes/subscription.js
 * Mounted under /api/subscription by server/index.js.
 * GET /plans is intentionally PUBLIC (no auth) so the marketing display
 * can show prices to guests too.
 */

const express = require('express');
const ctrl = require('../controllers/subscriptionController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();

router.get('/plans',    ctrl.getPlans);                     // public
router.get('/status',   requireUser, ctrl.getStatus);
router.post('/request', requireUser, ctrl.postRequest);

module.exports = router;
