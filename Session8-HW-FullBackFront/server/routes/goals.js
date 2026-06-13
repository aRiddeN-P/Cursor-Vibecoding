'use strict';

const express = require('express');
const ctrl = require('../controllers/goalsController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

router.get('/', ctrl.listGoalsEndpoint);
router.post('/', ctrl.createGoalEndpoint);
router.patch('/:id', ctrl.patchGoalEndpoint);
router.delete('/:id', ctrl.deleteGoalEndpoint);
router.post('/:id/contribute', ctrl.contributeEndpoint);
router.post('/:id/withdraw', ctrl.withdrawEndpoint);
router.get('/:id/history', ctrl.historyEndpoint);

module.exports = router;
