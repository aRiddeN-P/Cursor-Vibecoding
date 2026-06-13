/**
 * routes/stories.js
 * Mounts both user-facing and admin endpoints for stories.
 *
 *  User mount    → /api/stories
 *  Admin mount   → /api/admin/stories
 *
 * server/index.js is responsible for wiring this router under both prefixes.
 * We export TWO routers so each prefix gets only the relevant endpoints.
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const ctrl = require('../controllers/storiesController');

// ---------------- Middlewares ----------------

function requireUser(req, res, next) {
  if (req.session && req.session.user_id) return next();
  return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
}

function requireAdmin(req, res, next) {
  // Placeholder admin gate for Phase 3 — accepts a dev shortcut via header
  // so the admin upload endpoint can be exercised during development.
  // In production this will be replaced by a real admin login.
  if (req.session && req.session.isAdmin === true) return next();
  return res.status(401).json({ message: 'دسترسی غیرمجاز' });
}

// ---------------- Multer storage ----------------

const uploadsDir = path.resolve(__dirname, '..', 'uploads', 'stories');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeOriginal = (file.originalname || 'image')
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 80);
    cb(null, `story_${Date.now()}_${safeOriginal}`);
  },
});

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) return cb(null, true);
    return cb(null, false);
  },
});

/** Wraps multer's single() with Persian error translations. */
function uploadSingle(field) {
  return function (req, res, next) {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'حجم فایل بیش از ۵ مگابایت است' });
      }
      console.error('[multer] error:', err);
      return res.status(500).json({ message: 'خطای سرور در آپلود فایل' });
    });
  };
}

// ---------------- User router (/api/stories) ----------------

const userRouter = express.Router();

userRouter.get('/', requireUser, ctrl.listStories);
userRouter.get('/status', requireUser, ctrl.status);
userRouter.post('/mark-seen', requireUser, ctrl.markSeen);

// ---------------- Admin router (/api/admin/stories) ----------------

const adminRouter = express.Router();

// Dev-only endpoints (no admin gate — they ARE the gate).
// These are removed in production (controller returns 404).
adminRouter.post('/dev-login', ctrl.devLogin);
adminRouter.post('/dev-logout', ctrl.devLogout);
adminRouter.get('/admin-status', ctrl.adminStatus);

// Real admin endpoints (protected by req.session.isAdmin === true).
adminRouter.get('/', requireAdmin, ctrl.adminListAll);
adminRouter.post(
  '/upload',
  requireAdmin,
  uploadSingle('image'),
  ctrl.adminUpload
);
adminRouter.post(
  '/reset-for-users',
  requireAdmin,
  ctrl.adminResetForUsers
);
adminRouter.patch('/:id', requireAdmin, ctrl.adminTogglePatch);
adminRouter.delete('/:id', requireAdmin, ctrl.adminDelete);

module.exports = { userRouter, adminRouter };
