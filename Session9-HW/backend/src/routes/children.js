const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const childController = require('../controllers/childController');

const router = Router();

router.use(authMiddleware);

router.get('/', childController.listChildren);
router.post('/', childController.createChild);

module.exports = router;
