'use strict';

const express = require('express');
const ctrl = require('../../controllers/admin/adminStatsController');
const reviewCtrl = require('../../controllers/adminReviewController');
const { requireAdmin } = require('../../middlewares/adminAuth');

const router = express.Router();

router.use(requireAdmin);

router.get('/overview', ctrl.overview);
router.get('/growth', ctrl.growth);
router.get('/subscription-revenue', ctrl.subscriptionRevenue);
router.get('/engagement-trend', ctrl.engagementTrend);
router.get('/pending-verifications', ctrl.pendingVerifications);
router.get('/pending-subscriptions', ctrl.pendingSubscriptions);
router.get('/banners', ctrl.listBanners);

router.post('/pending-verifications/:id/approve', reviewCtrl.approveVerification);
router.post('/pending-verifications/:id/reject', reviewCtrl.rejectVerification);
router.post('/pending-subscriptions/:id/approve', reviewCtrl.approveSubscription);
router.post('/pending-subscriptions/:id/reject', reviewCtrl.rejectSubscription);

module.exports = router;
