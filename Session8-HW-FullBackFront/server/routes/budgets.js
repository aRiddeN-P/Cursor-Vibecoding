'use strict';

const express = require('express');
const ctrl = require('../controllers/budgetsController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

router.get('/', ctrl.getBudgetsEndpoint);
router.get('/zbb', ctrl.zbbEndpoint);
router.post('/bulk', ctrl.bulkBudgetsEndpoint);
router.post('/copy-from-last-month', ctrl.copyFromLastMonthEndpoint);
router.post('/', ctrl.createBudgetEndpoint);
router.delete('/:id', ctrl.deleteBudgetEndpoint);

module.exports = router;
