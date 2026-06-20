const { Router } = require('express');
const authController = require('../controllers/authController');

const router = Router();

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
