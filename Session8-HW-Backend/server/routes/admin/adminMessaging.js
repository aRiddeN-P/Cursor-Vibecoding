'use strict';

const express = require('express');
const multer = require('multer');
const ctrl = require('../../controllers/admin/adminMessagingController');
const { requireAdmin } = require('../../middlewares/adminAuth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const messagesRouter = express.Router();
messagesRouter.use(requireAdmin);
messagesRouter.post('/send', ctrl.sendMessage);
messagesRouter.post('/parse-mobiles', upload.single('file'), ctrl.parseMobiles);
messagesRouter.get('/history', ctrl.getHistory);
messagesRouter.get('/stats', ctrl.getStats);

const expertRouter = express.Router();
expertRouter.use(requireAdmin);
expertRouter.post('/send', ctrl.sendExpert);
expertRouter.post('/parse-mobiles', upload.single('file'), ctrl.parseMobiles);
expertRouter.get('/stats/:recommendationId', ctrl.getExpertStats);

messagesRouter.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'حجم فایل بیش از ۲ مگابایت است' });
    }
    return res.status(400).json({ message: 'خطا در آپلود فایل' });
  }
  return next(err);
});

expertRouter.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'حجم فایل بیش از ۲ مگابایت است' });
    }
    return res.status(400).json({ message: 'خطا در آپلود فایل' });
  }
  return next(err);
});

module.exports = { messagesRouter, expertRouter };
