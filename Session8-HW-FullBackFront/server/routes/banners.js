'use strict';

const fs = require('fs');
const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/bannersController');
const { requireUser, requireAdmin } = require('../middlewares/auth');

const uploadsDir = ctrl.uploadsRoot;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeOriginal = (file.originalname || 'banner.jpg')
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 80);
    cb(null, `banner_${Date.now()}_${safeOriginal}`);
  },
});

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    return cb(null, false);
  },
});

function uploadSingle(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) {
        if (req.method === 'POST' && !req.file) {
          return res.status(400).json({ message: 'فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود' });
        }
        return next();
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'حجم فایل بیش از ۳ مگابایت است' });
      }
      console.error('[banners multer]', err);
      return res.status(500).json({ message: 'خطای سرور در آپلود فایل' });
    });
  };
}

const userRouter = express.Router();
userRouter.use(requireUser);
userRouter.get('/active', ctrl.activeEndpoint);
userRouter.post('/:id/click', ctrl.clickEndpoint);

const adminRouter = express.Router();
adminRouter.use(requireAdmin);
adminRouter.get('/stats', ctrl.adminStatsEndpoint);
adminRouter.get('/', ctrl.adminListEndpoint);
adminRouter.post('/', uploadSingle('image'), ctrl.adminCreateEndpoint);
adminRouter.patch('/:id', uploadSingle('image'), ctrl.adminPatchEndpoint);
adminRouter.delete('/:id', ctrl.adminDeleteEndpoint);

module.exports = { userRouter, adminRouter };
