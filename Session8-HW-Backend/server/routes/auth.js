/**
 * routes/auth.js
 * Mounts all authentication endpoints under /api/auth.
 */

const express = require('express');
const ctrl = require('../controllers/authController');
const {
  loginRateLimiter,
  otpSendRateLimiter,
  otpVerifyRateLimiter,
} = require('../middlewares/rateLimiter');

const router = express.Router();

router.post('/login', loginRateLimiter, ctrl.login);
router.post('/check-duplicates', ctrl.checkDuplicates);
router.post('/send-otp', otpSendRateLimiter, ctrl.sendOtp);
router.post('/verify-otp', otpVerifyRateLimiter, ctrl.verifyOtp);
router.post('/register', ctrl.register);
router.post('/forgot-password', otpSendRateLimiter, ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.post('/logout', ctrl.logout);

module.exports = router;
