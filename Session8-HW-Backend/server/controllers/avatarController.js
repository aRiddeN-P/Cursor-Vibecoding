/**
 * avatarController.js
 *  - GET    /api/avatar/list       → all 40 avatars with lock status + current selection
 *  - PATCH  /api/avatar/select     → pick a dicebear seed (premium needs active sub)
 *  - POST   /api/avatar/upload     → upload a personal photo (needs active sub)
 *  - DELETE /api/avatar/custom     → remove personal photo, revert to last dicebear
 *
 * Security:
 *  - Seed names are validated against the hardcoded whitelist (40 seeds total).
 *  - Premium seeds and personal uploads require server-side subscription check.
 *  - Subscription expiry is re-evaluated on every list call so users see the
 *    correct lock state in real time.
 */

const fs = require('fs');
const path = require('path');

const db = require('../db/appDb');
const {
  isValidSeed,
  isPremiumSeed,
  dicebearUrl,
  getAvatarUrl,
  listAvatars,
  DEFAULT_SEED,
} = require('../utils/avatarHelper');
const subCtrl = require('./subscriptionController');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const stmts = {
  selectUser: db.prepare(`
    SELECT id, subscription_plan, subscription_expires_at,
           avatar_type, avatar_seed, avatar_custom_path, avatar_last_seed
    FROM users WHERE id = ?
  `),
  selectDicebear: db.prepare(`
    UPDATE users
       SET avatar_type = 'dicebear',
           avatar_seed = ?,
           avatar_last_seed = ?,
           avatar_custom_path = NULL
     WHERE id = ?
  `),
  setCustom: db.prepare(`
    UPDATE users
       SET avatar_type = 'custom',
           avatar_custom_path = ?
     WHERE id = ?
  `),
  clearCustom: db.prepare(`
    UPDATE users
       SET avatar_type = 'dicebear',
           avatar_custom_path = NULL
     WHERE id = ?
  `),
};

// ---------------- helpers ----------------

function hasActiveSubscription(user) {
  if (!user || !user.subscription_plan || !user.subscription_expires_at) return false;
  const t = new Date(user.subscription_expires_at + 'T00:00:00').getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

function deleteCustomFile(relPath) {
  if (!relPath) return;
  try {
    // Stored paths look like "/uploads/avatars/avatar_42_xxxx.jpg".
    // Resolve safely under the avatars folder; refuse anything outside.
    const filename = path.basename(relPath);
    const abs = path.join(UPLOADS_DIR, filename);
    if (abs.startsWith(UPLOADS_DIR) && fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  } catch (err) {
    console.warn('[avatar] failed to delete', relPath, err.message);
  }
}

// ============================================================
//                  GET /api/avatar/list
// ============================================================

function listEndpoint(req, res) {
  try {
    // Re-check the user's subscription expiry in real time before responding
    // so the lock states reflect the latest state.
    try { subCtrl.checkAndRevertExpiredSubscriptions(req.session.user_id); } catch (_) {}

    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    const active = hasActiveSubscription(user);
    const avatars = listAvatars(active);
    const currentUrl = getAvatarUrl(user);

    return res.json({
      current: {
        type: user.avatar_type || 'dicebear',
        seed: user.avatar_type === 'custom' ? null : (user.avatar_seed || DEFAULT_SEED),
        url: currentUrl,
        custom_path: user.avatar_type === 'custom' ? user.avatar_custom_path : null,
      },
      can_upload: active,
      has_active_subscription: active,
      avatars,
    });
  } catch (err) {
    console.error('[avatar.list] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//                 PATCH /api/avatar/select
// ============================================================

function selectEndpoint(req, res) {
  try {
    const seed = (req.body || {}).seed;
    if (!isValidSeed(seed)) {
      return res.status(400).json({ message: 'آواتار انتخابی معتبر نیست' });
    }

    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    if (isPremiumSeed(seed) && !hasActiveSubscription(user)) {
      return res.status(403).json({
        message: 'این آواتار مخصوص کاربران دارای اشتراک فعال است',
      });
    }

    // If they had a custom photo, delete it now (they're explicitly switching away).
    if (user.avatar_type === 'custom' && user.avatar_custom_path) {
      deleteCustomFile(user.avatar_custom_path);
    }

    stmts.selectDicebear.run(seed, seed, user.id);

    return res.json({
      success: true,
      message: 'آواتار با موفقیت تغییر یافت',
      avatar_url: dicebearUrl(seed),
      seed,
      type: 'dicebear',
    });
  } catch (err) {
    console.error('[avatar.select] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//                 POST /api/avatar/upload
// ============================================================

// `req.file` is populated by multer middleware (configured in routes/avatar.js).
function uploadEndpoint(req, res) {
  try {
    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      if (req.file) deleteCustomFile('/uploads/avatars/' + req.file.filename);
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    if (!hasActiveSubscription(user)) {
      if (req.file) deleteCustomFile('/uploads/avatars/' + req.file.filename);
      return res.status(403).json({
        message: 'آپلود عکس شخصی مخصوص کاربران دارای اشتراک فعال است',
      });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'فایل عکس ارسال نشده است' });
    }

    // Delete the previous custom photo (if any) before storing the new one.
    if (user.avatar_custom_path) {
      deleteCustomFile(user.avatar_custom_path);
    }

    const relPath = '/uploads/avatars/' + req.file.filename;
    stmts.setCustom.run(relPath, user.id);

    return res.json({
      success: true,
      message: 'عکس پروفایل با موفقیت بارگذاری شد',
      avatar_url: relPath,
      type: 'custom',
    });
  } catch (err) {
    console.error('[avatar.upload] error:', err);
    if (req.file) deleteCustomFile('/uploads/avatars/' + req.file.filename);
    return res.status(500).json({ message: 'خطای سرور در آپلود فایل' });
  }
}

// ============================================================
//                 DELETE /api/avatar/custom
// ============================================================

function deleteCustomEndpoint(req, res) {
  try {
    const user = stmts.selectUser.get(req.session.user_id);
    if (!user) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }

    if (user.avatar_type !== 'custom') {
      return res.status(400).json({ message: 'عکس شخصی تنظیم نشده است' });
    }

    if (user.avatar_custom_path) {
      deleteCustomFile(user.avatar_custom_path);
    }
    stmts.clearCustom.run(user.id);

    const seed = user.avatar_last_seed || user.avatar_seed || DEFAULT_SEED;
    return res.json({
      success: true,
      message: 'عکس حذف شد و آواتار قبلی بازگردانده شد',
      avatar_url: dicebearUrl(seed),
      seed,
      type: 'dicebear',
    });
  } catch (err) {
    console.error('[avatar.deleteCustom] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listEndpoint,
  selectEndpoint,
  uploadEndpoint,
  deleteCustomEndpoint,
  // helpers reused by routes
  _UPLOADS_DIR: UPLOADS_DIR,
  _deleteCustomFile: deleteCustomFile,
};
