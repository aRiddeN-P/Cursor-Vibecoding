const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const storyController = require('../controllers/storyController');

const router = Router();

router.get('/status', storyController.getStatus);
router.get('/', (req, res, next) => {
  if (req.query.source === 'parent') {
    return authMiddleware(req, res, () => storyController.listStories(req, res));
  }
  storyController.listStories(req, res);
});
router.get('/remaining', authMiddleware, storyController.getRemaining);
router.post('/generate-custom', authMiddleware, storyController.generateCustom);
router.post('/custom-text/analyze', authMiddleware, storyController.analyzeCustomText);
router.post('/custom-text', authMiddleware, storyController.submitCustomText);
router.get('/:id', storyController.getStory);
router.post('/:id/audio', authMiddleware, storyController.generateAudio);

module.exports = router;
