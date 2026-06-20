const jwt = require('jsonwebtoken');
const userModel = require('../models/user');

const JWT_EXPIRY = '30d';

function toEnglishDigits(str) {
  return String(str)
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

function normalizePhone(phone) {
  return toEnglishDigits(phone).replace(/\D/g, '');
}

function isValidPhone(phone) {
  const digits = normalizePhone(phone);
  return /^09\d{9}$/.test(digits);
}

function isValidOtp(otp) {
  const digits = toEnglishDigits(otp).replace(/\D/g, '');
  return /^\d{4}$/.test(digits);
}

function issueToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyOtp(phoneNumber, otpCode) {
  if (!isValidPhone(phoneNumber)) {
    return { error: 'Invalid phone number', status: 400 };
  }
  if (!isValidOtp(otpCode)) {
    return { error: 'OTP must be exactly 4 digits', status: 400 };
  }

  const normalized = normalizePhone(phoneNumber);
  let user = userModel.getByPhone(normalized);
  const isNewUser = !user;

  if (isNewUser) {
    user = userModel.createUser(normalized);
  }

  const token = issueToken(user.id);
  return { token, is_new_user: isNewUser };
}

module.exports = {
  normalizePhone,
  isValidPhone,
  isValidOtp,
  verifyOtp,
};
