/**
 * routes/profile.js
 * Mounted under /api/profile by server/index.js.
 */

const express = require('express');
const ctrl = require('../controllers/profileController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();

router.use(requireUser);

router.get('/',                       ctrl.getProfile);
router.patch('/',                     ctrl.patchProfile);
router.post('/change-password',       ctrl.changePassword);
router.get('/devices',                ctrl.listDevices);
router.delete('/devices/:deviceId',   ctrl.deleteDevice);
router.get('/invite-code',            ctrl.getInviteCode);

module.exports = router;
