'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const ctrl = require('../../controllers/admin/adminStoriesController');
const { requireAdmin } = require('../../middlewares/adminAuth');

const uploadsDir = ctrl.uploadsDir;
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

const upload = multer({
  storage,
  limits: { fileSize: ctrl.MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ctrl.ALLOWED_MIMES.has(file.mimetype)) return cb(null, true);
    return cb(null, false);
  },
});

function uploadSingle(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'حجم فایل بیش از ۵ مگابایت است' });
      }
      console.error('[adminStories multer]', err);
      return res.status(500).json({ message: 'خطای سرور در آپلود فایل' });
    });
  };
}

const router = express.Router();
router.use(requireAdmin);

router.get('/', ctrl.listStories);
router.post('/upload', uploadSingle('image'), ctrl.uploadStory);
router.post('/reset-for-users', ctrl.resetForUsers);
router.patch('/:id', ctrl.patchStory);
router.delete('/:id', ctrl.deleteStory);

module.exports = router;
