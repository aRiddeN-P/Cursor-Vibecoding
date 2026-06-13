/**
 * routes/transactions.js — Phase 5
 * Mounted under /api/transactions.
 *
 * Routes ordered so that the literal paths (`/sample-csv`, `/tags`,
 * `/summary`, `/recurring`, `/bulk-delete`, `/import`) match BEFORE the
 * parametric `/:id` — otherwise Express would treat e.g. "tags" as an id.
 */
'use strict';

const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/transactionsController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

// CSV uploads — kept in memory, hard cap at 2 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Literal paths first.
router.get ('/sample-csv', ctrl.sampleCsvEndpoint);
router.get ('/tags',       ctrl.tagsEndpoint);
router.get ('/summary',    ctrl.summaryEndpoint);
router.get ('/recurring',  ctrl.recurringEndpoint);
router.post('/bulk-delete', ctrl.bulkDeleteEndpoint);

router.post('/import', upload.single('file'), ctrl.importEndpoint);

// Collection.
router.get ('/',    ctrl.listEndpoint);
router.post('/',    ctrl.createEndpoint);

// Item-level.
router.get   ('/:id', ctrl.getOneEndpoint);
router.patch ('/:id', ctrl.patchEndpoint);
router.delete('/:id', ctrl.deleteEndpoint);

// Multer error handler — converts file-size errors into a friendly 413.
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'حجم فایل بیش از ۲ مگابایت است' });
    }
    return res.status(400).json({ message: 'خطا در آپلود فایل' });
  }
  return next(err);
});

module.exports = router;
