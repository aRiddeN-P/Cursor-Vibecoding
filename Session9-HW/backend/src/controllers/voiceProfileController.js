const { parseBuffer } = require('music-metadata');
const voiceProfileModel = require('../models/voiceProfile');
const elevenLabs = require('../services/elevenLabsService');

const MIN_DURATION_SEC = 30;
const MAX_DURATION_SEC = 300;

function formatProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    elevenlabs_voice_id: profile.elevenlabs_voice_id,
    created_at: profile.created_at,
  };
}

function listProfiles(req, res) {
  const profiles = voiceProfileModel.getByUserId(req.userId).map(formatProfile);
  res.json({ success: true, voice_profiles: profiles });
}

async function createProfile(req, res) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

  if (!name) {
    return res.status(400).json({ success: false, message: 'نام صدا الزامی است' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'فایل صوتی الزامی است' });
  }

  try {
    const metadata = await parseBuffer(req.file.buffer, { mimeType: req.file.mimetype });
    const duration = metadata.format.duration || 0;

    if (duration < MIN_DURATION_SEC) {
      return res.status(400).json({ success: false, message: 'صدا باید حداقل ۳۰ ثانیه باشد' });
    }

    if (duration > MAX_DURATION_SEC) {
      return res.status(400).json({ success: false, message: 'صدا نباید بیشتر از ۵ دقیقه باشد' });
    }

    const elevenlabsVoiceId = await elevenLabs.cloneVoice(
      name,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    const profile = voiceProfileModel.create(req.userId, name, elevenlabsVoiceId);

    res.status(201).json({ success: true, voice_profile: formatProfile(profile) });
  } catch (err) {
    console.error('Voice profile creation failed:', err.message);
    res.status(500).json({
      success: false,
      message: 'مشکلی در ساخت صدا پیش آمد. لطفاً دوباره امتحان کن.',
    });
  }
}

async function deleteProfile(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid voice profile id' });
  }

  const profile = voiceProfileModel.getById(id);

  if (!profile || profile.user_id !== req.userId) {
    return res.status(404).json({ success: false, message: 'Voice profile not found' });
  }

  try {
    await elevenLabs.deleteVoice(profile.elevenlabs_voice_id);
    voiceProfileModel.deleteById(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Voice profile deletion failed:', err.message);
    res.status(500).json({
      success: false,
      message: 'مشکلی در حذف صدا پیش آمد. لطفاً دوباره امتحان کن.',
    });
  }
}

module.exports = {
  listProfiles,
  createProfile,
  deleteProfile,
};
