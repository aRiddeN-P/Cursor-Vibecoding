const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const voiceProfileController = require('../controllers/voiceProfileController');

const router = Router();

router.get('/', authMiddleware, voiceProfileController.listProfiles);
router.post(
  '/',
  authMiddleware,
  upload.single('audio_file'),
  voiceProfileController.createProfile
);
router.delete('/:id', authMiddleware, voiceProfileController.deleteProfile);

module.exports = router;
