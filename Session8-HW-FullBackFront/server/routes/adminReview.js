/**
 * routes/adminReview.js
 * Mounted under /api/admin by server/index.js.
 *
 * All endpoints require req.session.isAdmin === true (set by the
 * dev shortcut /api/admin/stories/dev-login while the real admin
 * login is being built).
 */

const express = require('express');
const ctrl = require('../controllers/adminReviewController');
const { requireAdmin } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAdmin);

// Verifications
router.get('/verifications',                  ctrl.listVerifications);
router.post('/verifications/:id/approve',     ctrl.approveVerification);
router.post('/verifications/:id/reject',      ctrl.rejectVerification);

// Subscriptions
router.get('/subscriptions',                  ctrl.listSubscriptions);
router.post('/subscriptions/:id/approve',     ctrl.approveSubscription);
router.post('/subscriptions/:id/reject',      ctrl.rejectSubscription);

module.exports = router;
