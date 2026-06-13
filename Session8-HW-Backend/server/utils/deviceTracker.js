/**
 * deviceTracker.js
 * Parses User-Agent into a friendly device name and upserts into
 * connected_devices. Called from authController on successful login
 * and from anywhere else that wants to refresh "last seen".
 */

const db = require('../db/appDb');

function parseUserAgent(uaRaw) {
  const uaOrig = String(uaRaw || '').trim();
  const ua = uaOrig.toLowerCase();

  let device_type = 'desktop';
  if (/ipad|tablet/.test(ua)) device_type = 'tablet';
  else if (/mobi|android|iphone|ipod/.test(ua)) device_type = 'mobile';

  let browser = null;
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
  else if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';

  let os = null;
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  let device_name;
  if (browser && os) {
    device_name = `${browser} on ${os}`;
  } else if (uaOrig) {
    // Fallback for curl / postman / unknown clients — show first token only.
    device_name = uaOrig.split(/\s+/)[0].slice(0, 60);
  } else {
    device_name = 'دستگاه ناشناس';
  }

  return { device_type, device_name };
}

const stmts = {
  findSame: db.prepare(`
    SELECT id FROM connected_devices
    WHERE user_id = ? AND ip_address = ? AND user_agent = ?
    LIMIT 1
  `),
  touchExisting: db.prepare(`
    UPDATE connected_devices SET last_active = CURRENT_TIMESTAMP WHERE id = ?
  `),
  insertNew: db.prepare(`
    INSERT INTO connected_devices (user_id, device_name, device_type, user_agent, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `),
};

/**
 * trackDevice — upsert device row for a logged-in user.
 * Safe to call multiple times for the same UA+IP combination.
 *
 * @param {number} userId
 * @param {{ headers: object, ip: string, socket?: { remoteAddress?: string } }} req
 * @returns {number} device id
 */
function trackDevice(userId, req) {
  try {
    const ua = (req.headers && req.headers['user-agent']) || '';
    const ip =
      (req.headers && (req.headers['x-forwarded-for'] || '').split(',')[0].trim()) ||
      req.ip ||
      (req.socket && req.socket.remoteAddress) ||
      'unknown';

    const existing = stmts.findSame.get(userId, ip, ua);
    if (existing) {
      stmts.touchExisting.run(existing.id);
      return existing.id;
    }

    const parsed = parseUserAgent(ua);
    const info = stmts.insertNew.run(
      userId,
      parsed.device_name,
      parsed.device_type,
      ua,
      ip
    );
    return Number(info.lastInsertRowid);
  } catch (err) {
    // Device tracking should never break the login flow.
    console.warn('[deviceTracker] failed:', err.message);
    return null;
  }
}

module.exports = { trackDevice, parseUserAgent };
