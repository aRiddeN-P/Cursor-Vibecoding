'use strict';

const express = require('express');
const ctrl = require('../controllers/splitController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();

router.get('/public/:token', ctrl.publicEndpoint);

router.use(requireUser);

router.get('/groups', ctrl.listGroupsEndpoint);
router.post('/groups', ctrl.createGroupEndpoint);
router.get('/groups/:id', ctrl.getGroupEndpoint);
router.post('/groups/:id/members', ctrl.addMemberEndpoint);
router.delete('/groups/:id/members/:memberId', ctrl.removeMemberEndpoint);
router.post('/groups/:id/expenses', ctrl.addExpenseEndpoint);
router.patch('/groups/:id/expenses/:expenseId', ctrl.patchExpenseEndpoint);
router.delete('/groups/:id/expenses/:expenseId', ctrl.deleteExpenseEndpoint);
router.post('/groups/:id/settle', ctrl.settleEndpoint);
router.get('/lookup-mobile', ctrl.lookupMobileEndpoint);

module.exports = router;
