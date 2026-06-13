'use strict';

const express = require('express');
const ctrl = require('../../controllers/admin/adminRecommendationsController');
const { requireAdmin } = require('../../middlewares/adminAuth');

const router = express.Router();
router.use(requireAdmin);

router.get('/recommendations/subscriber-count', ctrl.getSubscriberCount);
router.get('/recommendations', ctrl.listRecommendations);
router.post('/recommendations', ctrl.createRecommendation);
router.get('/recommendations/:id/stats', ctrl.getRecommendationStats);
router.patch('/recommendations/:id', ctrl.patchRecommendation);
router.delete('/recommendations/:id', ctrl.deleteRecommendation);

module.exports = router;
