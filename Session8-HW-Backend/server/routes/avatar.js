/**
 * routes/avatar.js
 * Mounted under /api/avatar by server/index.js.
 * All endpoints require a logged-in user (session.user_id).
 */

const path = require('path');
const express = require('express');
const multer = require('multer');

const ctrl = require('../controllers/avatarController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();

// ---------------- Multer (avatar uploads) ----------------

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ctrl._UPLOADS_DIR),
  filename: (req, file, cb) => {
    // Never trust originalname — build a safe filename from session.user_id
    // and a timestamp. Path traversal becomes impossible because there's
    // no user-supplied component in the path.
    const ext = (path.extname(file.originalname || '').toLowerCase() || '.jpg');
    const safeExt = ALLOWED_EXTS.has(ext) ? ext : '.jpg';
    const uid = (req.session && req.session.user_id) || 0;
    cb(null, `avatar_${uid}_${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_MIMES.has(file.mimetype) && ALLOWED_EXTS.has(ext)) {
      return cb(null, true);
    }
    return cb(null, false);
  },
});

/** Wrap multer.single() and translate errors to Persian responses. */
function uploadSinglePhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) {
      // multer with fileFilter:false silently skips file → req.file undefined
      if (!req.file) {
        return res.status(400).json({
          message: 'فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود',
        });
      }
      return next();
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'حجم فایل بیش از ۳ مگابایت است' });
    }
    console.error('[avatar upload multer] error:', err);
    return res.status(500).json({ message: 'خطای سرور در آپلود فایل' });
  });
}

// ---------------- Routes ----------------

router.use(requireUser);

router.get('/list',         ctrl.listEndpoint);
router.patch('/select',     ctrl.selectEndpoint);
router.post('/upload',      uploadSinglePhoto, ctrl.uploadEndpoint);
router.delete('/custom',    ctrl.deleteCustomEndpoint);

module.exports = router;
