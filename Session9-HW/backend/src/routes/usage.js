const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const usageController = require('../controllers/usageController');

const router = Router();

router.get('/services', authMiddleware, usageController.getServiceUsage);

module.exports = router;
