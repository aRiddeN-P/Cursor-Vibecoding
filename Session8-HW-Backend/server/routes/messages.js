/**
 * routes/messages.js — Phase 3-D
 * Mounted under /api/messages by server/index.js.
 */
'use strict';

const express = require('express');
const ctrl = require('../controllers/messagesController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

router.get('/',              ctrl.listEndpoint);
router.patch('/read-all',    ctrl.markAllReadEndpoint);
router.patch('/:id/read',    ctrl.markReadEndpoint);
router.delete('/:id',        ctrl.deleteEndpoint);

module.exports = router;
