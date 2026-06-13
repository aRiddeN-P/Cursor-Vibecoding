'use strict';

const express = require('express');
const ctrl = require('../../controllers/admin/adminCategoriesController');
const { requireAdmin } = require('../../middlewares/adminAuth');

const router = express.Router();
router.use(requireAdmin);

router.get('/requests', ctrl.listRequests);
router.patch('/requests/:id', ctrl.decideRequest);
router.get('/defaults', ctrl.listDefaults);
router.post('/defaults', ctrl.createDefault);
router.patch('/defaults/:id', ctrl.patchDefault);

module.exports = router;
