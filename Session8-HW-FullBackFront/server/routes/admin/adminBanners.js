'use strict';

const express = require('express');
const fs = require('fs');
const multer = require('multer');
const bannersCtrl = require('../../controllers/bannersController');
const { logActivity, getClientIp } = require('../../controllers/admin/adminAuthController');
const { requireAdmin } = require('../../middlewares/adminAuth');

const uploadsDir = bannersCtrl.uploadsRoot;
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = (file.originalname || 'banner.jpg').replace(/[^\w.\-]+/g, '_').slice(0, 80);
    cb(null, `banner_${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (new Set(['image/jpeg', 'image/png', 'image/webp']).has(file.mimetype)) return cb(null, true);
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
      return res.status(500).json({ message: 'خطای سرور در آپلود فایل' });
    });
  };
}

function wrapJson(res, req, action, targetType, getTargetId) {
  const orig = res.json.bind(res);
  res.json = (body) => {
    if (body && (body.success || res.statusCode < 400)) {
      logActivity(req.session.adminId, action, {
        target_type: targetType,
        target_id: getTargetId(body, req),
        ip: getClientIp(req),
        detail: body.banner ? { title: body.banner.title } : undefined,
      });
    }
    return orig(body);
  };
}

const router = express.Router();
router.use(requireAdmin);

router.get('/stats', bannersCtrl.adminStatsEndpoint);
router.get('/', bannersCtrl.adminListEndpoint);

router.post('/', uploadSingle('image'), (req, res) => {
  wrapJson(res, req, 'create_banner', 'banner', (body) => body.banner?.id);
  bannersCtrl.adminCreateEndpoint(req, res);
});

router.patch('/:id', uploadSingle('image'), (req, res) => {
  wrapJson(res, req, 'update_banner', 'banner', (_body, r) => Number(r.params.id));
  bannersCtrl.adminPatchEndpoint(req, res);
});

router.delete('/:id', (req, res) => {
  wrapJson(res, req, 'delete_banner', 'banner', (_body, r) => Number(r.params.id));
  bannersCtrl.adminDeleteEndpoint(req, res);
});

module.exports = router;
