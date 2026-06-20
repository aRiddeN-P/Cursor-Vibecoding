const geminiUsageTracker = require('../services/geminiUsageTracker');
const elevenLabs = require('../services/elevenLabsService');
const { isGeminiConfigured } = require('../services/geminiService');

async function getServiceUsage(_req, res) {
  const gemini = isGeminiConfigured()
    ? geminiUsageTracker.getSnapshot()
    : { configured: false };

  let elevenlabs = { configured: false };

  try {
    elevenlabs = await elevenLabs.getSubscriptionUsage();
  } catch (err) {
    console.error('ElevenLabs usage fetch failed:', err.message);
    elevenlabs = {
      configured: Boolean(process.env.ELEVENLABS_API_KEY),
      available: false,
      error: 'مشکلی در دریافت وضعیت ElevenLabs پیش آمد',
    };
  }

  res.json({
    success: true,
    gemini,
    elevenlabs,
  });
}

module.exports = { getServiceUsage };
