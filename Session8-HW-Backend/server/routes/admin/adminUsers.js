'use strict';

const express = require('express');
const ctrl = require('../../controllers/admin/adminUsersController');
const { requireAdmin } = require('../../middlewares/adminAuth');

const router = express.Router();
router.use(requireAdmin);

router.get('/search', ctrl.searchUsers);
router.post('/reset-stories-all', ctrl.resetStoriesAll);
router.get('/', ctrl.listUsers);
router.get('/:id', ctrl.getUserById);
router.patch('/:id/reset-stories', ctrl.resetStoriesUser);

module.exports = router;
