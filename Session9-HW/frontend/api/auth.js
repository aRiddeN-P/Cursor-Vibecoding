import { API_BASE } from './config.js';

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

export function sendOtp(phoneNumber) {
  return post('/auth/send-otp', { phone_number: phoneNumber });
}

export function verifyOtp(phoneNumber, otpCode) {
  return post('/auth/verify-otp', { phone_number: phoneNumber, otp_code: otpCode });
}
