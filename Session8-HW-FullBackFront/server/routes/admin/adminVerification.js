'use strict';

const express = require('express');
const ctrl = require('../../controllers/admin/adminVerificationController');
const { requireAdmin } = require('../../middlewares/adminAuth');

const router = express.Router();
router.use(requireAdmin);

router.get('/requests', ctrl.listRequests);
router.patch('/requests/:id', ctrl.patchRequest);

module.exports = router;
