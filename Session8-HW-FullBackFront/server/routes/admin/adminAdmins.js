'use strict';

const express = require('express');
const ctrl = require('../../controllers/admin/adminAdminsController');
const { requireAdmin, requireSuperAdmin } = require('../../middlewares/adminAuth');

const router = express.Router();
router.use(requireAdmin, requireSuperAdmin);

router.get('/', ctrl.listAdmins);
router.post('/', ctrl.createAdmin);
router.patch('/:id', ctrl.updateAdmin);
router.delete('/:id', ctrl.deleteAdmin);

module.exports = router;
