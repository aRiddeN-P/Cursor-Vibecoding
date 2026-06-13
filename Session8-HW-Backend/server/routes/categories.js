/**
 * routes/categories.js — Phase 4
 * Mounted under /api/categories.
 *
 *   GET  /                — list categories visible to the user
 *   POST /request         — submit a new custom category request
 *   GET  /requests        — list the current user's category requests
 */
'use strict';

const express = require('express');
const ctrl = require('../controllers/categoriesController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

router.get('/',         ctrl.listCategories);
router.post('/request', ctrl.requestCategory);
router.get('/requests', ctrl.listMyRequests);

module.exports = router;
