/**
 * routes/verification.js
 * Mounted under /api/verification by server/index.js.
 */

const express = require('express');
const ctrl = require('../controllers/verificationController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

router.get('/status',    ctrl.getStatus);
router.post('/request',  ctrl.postRequest);

module.exports = router;
