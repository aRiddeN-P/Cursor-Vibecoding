'use strict';

const express = require('express');
const ctrl = require('../controllers/expertController');
const { requireUser } = require('../middlewares/auth');

const router = express.Router();
router.use(requireUser);

router.get('/recommendations', ctrl.listRecommendationsEndpoint);
router.get('/recommendations/:id', ctrl.getRecommendationEndpoint);
router.patch('/recommendations/:id/status', ctrl.patchStatusEndpoint);

module.exports = router;
