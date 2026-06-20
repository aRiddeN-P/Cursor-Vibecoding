const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype?.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('فقط فایل صوتی مجاز است'));
    }
  },
});

module.exports = upload;
