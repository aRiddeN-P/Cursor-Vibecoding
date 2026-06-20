const authService = require('../services/authService');

function sendOtp(req, res) {
  const { phone_number } = req.body;

  if (!phone_number || !authService.isValidPhone(phone_number)) {
    return res.status(400).json({ success: false, message: 'Invalid phone number' });
  }

  const normalized = authService.normalizePhone(phone_number);
  console.log(`OTP requested for ${normalized}`);

  res.json({ success: true, message: 'Code sent' });
}

function verifyOtp(req, res) {
  const { phone_number, otp_code } = req.body;

  if (!phone_number || !otp_code) {
    return res.status(400).json({ success: false, message: 'Phone number and OTP are required' });
  }

  const result = authService.verifyOtp(phone_number, otp_code);

  if (result.error) {
    return res.status(result.status).json({ success: false, message: result.error });
  }

  res.json({
    success: true,
    token: result.token,
    is_new_user: result.is_new_user,
  });
}

module.exports = { sendOtp, verifyOtp };
