'use strict';

const express = require('express');
const ctrl = require('../controllers/reportsController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

router.get('/monthly', ctrl.monthlyReportEndpoint);
router.get('/comparison', ctrl.comparisonReportEndpoint);
router.get('/weekly-pattern', ctrl.weeklyPatternEndpoint);
router.get('/cash-flow-forecast', ctrl.cashFlowForecastEndpoint);
router.get('/net-worth-snapshot', ctrl.netWorthSnapshotEndpoint);
router.get('/subscription-tracker', ctrl.subscriptionTrackerEndpoint);
router.get('/score/history', ctrl.scoreHistoryEndpoint);
router.get('/insights', ctrl.insightsEndpoint);
router.get('/score', ctrl.scoreEndpoint);
router.get('/export/csv', ctrl.exportCsvEndpoint);
router.get('/export/pdf', ctrl.exportPdfEndpoint);

module.exports = router;
