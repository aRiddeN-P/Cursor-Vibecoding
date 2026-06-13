/**
 * storiesController.js
 * User-facing + admin endpoints for onboarding stories.
 *
 * Two databases are read independently:
 *  - appDb   → reads/writes users.has_seen_stories
 *  - adminDb → reads/writes stories table
 *
 * Auth conventions (matches existing authController):
 *  - User endpoints  → require req.session.user_id
 *  - Admin endpoints → require req.session.isAdmin === true (placeholder for Phase 3)
 */

const fs = require('fs');
const path = require('path');
const appDb = require('../db/appDb');
const adminDb = require('../db/adminDb');

// ---------------- Prepared statements ----------------

const appStmts = {
  selectHasSeen: appDb.prepare(
    'SELECT has_seen_stories FROM users WHERE id = ?'
  ),
  updateHasSeen: appDb.prepare(
    'UPDATE users SET has_seen_stories = 1 WHERE id = ?'
  ),
  resetAllHasSeen: appDb.prepare('UPDATE users SET has_seen_stories = 0'),
};

const adminStmts = {
  activeStories: adminDb.prepare(
    'SELECT id, order_index, image_path FROM stories WHERE is_active = 1 ORDER BY order_index ASC'
  ),
  allStories: adminDb.prepare(
    'SELECT id, order_index, image_path, is_active, created_at FROM stories ORDER BY order_index ASC, id ASC'
  ),
  insertStory: adminDb.prepare(
    'INSERT INTO stories (order_index, image_path, is_active) VALUES (?, ?, 1)'
  ),
  storyById: adminDb.prepare('SELECT * FROM stories WHERE id = ?'),
  toggleActive: adminDb.prepare(
    'UPDATE stories SET is_active = ? WHERE id = ?'
  ),
  deleteStory: adminDb.prepare('DELETE FROM stories WHERE id = ?'),
  countSameImage: adminDb.prepare(
    'SELECT COUNT(*) as cnt FROM stories WHERE image_path = ?'
  ),
};

// ---------------- Helpers ----------------

function toImageUrl(imagePath) {
  // image_path is stored as a full URL path like "/uploads/stories/foo.jpg"
  // so we can return it directly. For backward-safety, normalize bare filenames.
  if (!imagePath) return '';
  if (imagePath.startsWith('/')) return imagePath;
  return '/uploads/stories/' + imagePath;
}

// ============================================================
//                        USER ENDPOINTS
// ============================================================

/**
 * GET /api/stories
 * Returns active stories ordered by order_index.
 */
function listStories(_req, res) {
  try {
    const rows = adminStmts.activeStories.all();
    const stories = rows.map((r) => ({
      id: r.id,
      order_index: r.order_index,
      image_url: toImageUrl(r.image_path),
    }));
    return res.json({ stories });
  } catch (err) {
    console.error('[listStories] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

/**
 * POST /api/stories/mark-seen
 * Sets users.has_seen_stories = 1 for the logged-in user.
 */
function markSeen(req, res) {
  try {
    const userId = req.session.user_id;
    appStmts.updateHasSeen.run(userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[markSeen] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

/**
 * GET /api/stories/status
 * Returns whether the current user has seen the stories.
 */
function status(req, res) {
  try {
    const userId = req.session.user_id;
    const row = appStmts.selectHasSeen.get(userId);
    if (!row) {
      return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
    }
    return res.json({ has_seen_stories: row.has_seen_stories ? 1 : 0 });
  } catch (err) {
    console.error('[status] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//                       ADMIN ENDPOINTS
// ============================================================

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/admin/stories/upload
 * Multipart/form-data: image (file), order_index (integer)
 *
 * Multer handles the upload before this controller runs. We then:
 *  - Re-validate mimetype + extension (defense in depth)
 *  - Validate order_index
 *  - Insert into stories table
 *  - Return the created row with image_url
 */
function adminUpload(req, res) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        message: 'فایل تصویر ارسال نشده است',
      });
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_MIMES.has(file.mimetype) || !ALLOWED_EXTS.has(ext)) {
      // Remove the unwanted file from disk to avoid clutter.
      fs.unlink(file.path, () => {});
      return res.status(400).json({
        message: 'فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود',
      });
    }

    if (file.size > MAX_FILE_BYTES) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ message: 'حجم فایل بیش از ۵ مگابایت است' });
    }

    const orderIndexRaw = req.body.order_index;
    const orderIndex = Number.parseInt(orderIndexRaw, 10);
    if (!Number.isInteger(orderIndex) || orderIndex < 1) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({
        message: 'ترتیب نمایش معتبر نیست — باید عدد صحیح و بزرگ‌تر از صفر باشد',
      });
    }

    const imagePath = '/uploads/stories/' + file.filename;
    const info = adminStmts.insertStory.run(orderIndex, imagePath);
    const story = adminStmts.storyById.get(info.lastInsertRowid);

    return res.json({
      success: true,
      story: {
        id: story.id,
        order_index: story.order_index,
        image_url: toImageUrl(story.image_path),
      },
    });
  } catch (err) {
    console.error('[adminUpload] error:', err);
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({ message: 'خطای سرور در آپلود فایل' });
  }
}

/**
 * POST /api/admin/stories/reset-for-users
 * Resets has_seen_stories for all users so the stories play again on next visit.
 */
function adminResetForUsers(_req, res) {
  try {
    const info = appStmts.resetAllHasSeen.run();
    return res.json({
      success: true,
      message: 'استوری برای همه کاربران ریست شد',
      affected_users: info.changes,
    });
  } catch (err) {
    console.error('[adminResetForUsers] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

/**
 * GET /api/admin/stories
 * Returns ALL stories (active + inactive), for the admin panel UI.
 */
function adminListAll(_req, res) {
  try {
    const rows = adminStmts.allStories.all();
    const stories = rows.map((r) => ({
      id: r.id,
      order_index: r.order_index,
      image_url: toImageUrl(r.image_path),
      image_path: r.image_path,
      is_active: r.is_active ? 1 : 0,
      created_at: r.created_at,
    }));
    return res.json({ stories });
  } catch (err) {
    console.error('[adminListAll] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

/**
 * PATCH /api/admin/stories/:id
 * Body: { is_active: 0|1 }
 * Toggles the is_active flag for a story.
 */
function adminTogglePatch(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه استوری معتبر نیست' });
    }
    const story = adminStmts.storyById.get(id);
    if (!story) {
      return res.status(404).json({ message: 'استوری یافت نشد' });
    }
    const next = req.body && (req.body.is_active === 1 || req.body.is_active === true || req.body.is_active === '1') ? 1 : 0;
    adminStmts.toggleActive.run(next, id);
    return res.json({ success: true, id, is_active: next });
  } catch (err) {
    console.error('[adminTogglePatch] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

/**
 * DELETE /api/admin/stories/:id
 * Removes a story row, and deletes its file from disk if it is an
 * uploaded story (filename starts with "story_") and no other story
 * row references the same file.
 */
function adminDelete(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه استوری معتبر نیست' });
    }
    const story = adminStmts.storyById.get(id);
    if (!story) {
      return res.status(404).json({ message: 'استوری یافت نشد' });
    }
    adminStmts.deleteStory.run(id);

    // Only delete the file when it is an uploaded story (not the seed
    // placeholder) and no other DB row still references it.
    const filename = path.basename(story.image_path || '');
    const refCount = adminStmts.countSameImage.get(story.image_path).cnt;
    if (refCount === 0 && filename && filename.startsWith('story_')) {
      const onDisk = path.resolve(__dirname, '..', 'uploads', 'stories', filename);
      fs.unlink(onDisk, () => {});
    }

    return res.json({ success: true, id });
  } catch (err) {
    console.error('[adminDelete] error:', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

// ============================================================
//        DEV-ONLY admin login shortcut (Phase 2 placeholder)
//   Removed/replaced by the real admin login in Phase 3.
// ============================================================

function devLogin(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'مسیر مورد نظر یافت نشد' });
  }
  req.session.isAdmin = true;
  return res.json({
    success: true,
    message: 'ورود به حالت ادمین (Dev) فعال شد',
  });
}

function devLogout(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'مسیر مورد نظر یافت نشد' });
  }
  req.session.isAdmin = false;
  return res.json({ success: true, message: 'از حالت ادمین خارج شدید' });
}

function adminStatus(req, res) {
  return res.json({
    isAdmin: req.session && req.session.isAdmin === true,
    dev_mode_available: process.env.NODE_ENV !== 'production',
  });
}

module.exports = {
  listStories,
  markSeen,
  status,
  adminUpload,
  adminResetForUsers,
  adminListAll,
  adminTogglePatch,
  adminDelete,
  devLogin,
  devLogout,
  adminStatus,
  _internals: { ALLOWED_MIMES, MAX_FILE_BYTES },
};
