'use strict';

const express = require('express');
const ctrl = require('../controllers/expertController');
const { requireAdmin } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/recommendations', ctrl.adminListEndpoint);
router.post('/recommendations', ctrl.adminCreateEndpoint);
router.patch('/recommendations/:id', ctrl.adminPatchEndpoint);
router.delete('/recommendations/:id', ctrl.adminDeleteEndpoint);

module.exports = router;
