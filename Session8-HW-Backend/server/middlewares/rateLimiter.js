/**
 * rateLimiter.js
 * Lightweight in-memory IP-based rate limiters.
 * Login lockout itself is handled per-mobile inside the login controller
 * (via the login_attempts table). These middlewares add a soft IP shield
 * against brute-force / spam at the network layer.
 */

function createRateLimiter({ windowMs, max, message }) {
  const buckets = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets.entries()) {
      if (entry.resetAt <= now) buckets.delete(key);
    }
  }, Math.max(30_000, windowMs)).unref?.();

  return function rateLimiter(req, res, next) {
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      'unknown';

    const now = Date.now();
    let entry = buckets.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const remaining = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(remaining));
      return res.status(429).json({
        message,
        remaining_seconds: remaining,
      });
    }

    next();
  };
}

const loginRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'تعداد درخواست‌ها از این IP بیش از حد مجاز است — کمی صبر کنید',
});

const otpSendRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'تعداد درخواست‌های ارسال کد بیش از حد مجاز است — کمی صبر کنید',
});

const otpVerifyRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'تعداد تلاش‌های تایید کد بیش از حد مجاز است — کمی صبر کنید',
});

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  otpSendRateLimiter,
  otpVerifyRateLimiter,
};
