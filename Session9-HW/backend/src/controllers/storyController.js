const storyModel = require('../models/story');
const childModel = require('../models/child');
const voiceProfileModel = require('../models/voiceProfile');
const generationLog = require('../models/storyGenerationLog');
const {
  generateStory,
  checkContentSafety,
  extractTheme,
  extractEmoji,
  suggestAgeGroup,
  isGeminiConfigured,
} = require('../services/geminiService');
const elevenLabs = require('../services/elevenLabsService');

const LIBRARY_READY_MIN = 30;

const VALID_AGE_GROUPS = ['0-2', '3-5', '6-7'];
const DAILY_LIMIT_MESSAGE =
  'امروز ۵ قصه تازه ساختی! فردا دوباره می‌تونیم قصه جدید بسازیم 🌙 — تا اون موقع می‌تونی از کتابخونه قصه‌ها لذت ببری';

function formatStory(story) {
  return {
    id: story.id,
    title: story.title,
    content: story.content,
    age_group: story.age_group,
    theme: story.theme,
    emoji: story.emoji,
    audio_url: story.audio_url,
    is_custom: Boolean(story.is_custom),
    approval_status: story.approval_status || 'approved',
    gemini_suggested_age_group: story.gemini_suggested_age_group || null,
    created_at: story.created_at,
  };
}

function formatStorySummary(story) {
  return {
    id: story.id,
    title: story.title,
    emoji: story.emoji,
    theme: story.theme,
    age_group: story.age_group,
    is_custom: Boolean(story.is_custom),
    approval_status: story.approval_status || 'approved',
    gemini_suggested_age_group: story.gemini_suggested_age_group || null,
  };
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function retryPendingParentStories(userId) {
  if (!isGeminiConfigured()) return;

  const pendingStories = storyModel.getPendingByParentUser(userId);

  for (const story of pendingStories) {
    try {
      const safety = await checkContentSafety(story.content);
      if (safety === 'unsafe') continue;

      const [theme, emoji, geminiSuggestedAgeGroup] = await Promise.all([
        extractTheme(story.content),
        extractEmoji(story.content, story.title),
        suggestAgeGroup(story.content, story.title),
      ]);

      storyModel.markParentStoryApproved(story.id, theme, emoji, geminiSuggestedAgeGroup);
    } catch (err) {
      console.error(`Pending story ${story.id} retry failed:`, err.message);
    }
  }
}

function listStories(req, res) {
  const { age_group: ageGroup, source } = req.query;

  if (source === 'parent') {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    retryPendingParentStories(req.userId).catch(() => {});

    const stories = (
      ageGroup && VALID_AGE_GROUPS.includes(ageGroup)
        ? storyModel.getByParentUser(ageGroup, req.userId)
        : storyModel.getAllByParentUser(req.userId)
    ).map(formatStorySummary);

    return res.json({ success: true, stories });
  }

  if (!ageGroup || !VALID_AGE_GROUPS.includes(ageGroup)) {
    return res.status(400).json({
      success: false,
      message: 'age_group is required and must be one of: 0-2, 3-5, 6-7',
    });
  }

  const stories = storyModel.getByAgeGroup(ageGroup).map(formatStorySummary);
  res.json({ success: true, stories });
}

function getStory(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid story id' });
  }

  const story = storyModel.getById(id);

  if (!story) {
    return res.status(404).json({ success: false, message: 'Story not found' });
  }

  if (story.submitted_by_user_id && story.approval_status === 'pending') {
    return res.status(403).json({
      success: false,
      message: 'این قصه هنوز تأیید نشده و نمی‌تونی ازش استفاده کنی. بعداً دوباره امتحان کن 🌙',
      code: 'story_pending',
    });
  }

  res.json({ success: true, story: formatStory(story) });
}

function validateParentStoryInput(title, content) {
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  const trimmedContent = typeof content === 'string' ? content.trim() : '';

  if (!trimmedTitle || trimmedTitle.length < 3 || trimmedTitle.length > 100) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message: 'عنوان قصه باید بین ۳ تا ۱۰۰ کاراکتر باشد',
        },
      },
    };
  }

  if (!trimmedContent || countWords(trimmedContent) < 50) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message: 'متن قصه باید حداقل ۵۰ کلمه داشته باشد',
          code: 'too_short',
          words: countWords(trimmedContent),
        },
      },
    };
  }

  return { trimmedTitle, trimmedContent };
}

async function analyzeCustomText(req, res) {
  const { title, content } = req.body || {};
  const validation = validateParentStoryInput(title, content);

  if (validation.error) {
    return res.status(validation.error.status).json(validation.error.body);
  }

  const { trimmedTitle, trimmedContent } = validation;

  if (!isGeminiConfigured()) {
    return res.json({
      success: true,
      gemini_available: false,
      message: 'سرویس بررسی هوش مصنوعی الان در دسترس نیست. می‌تونی قصه رو ذخیره کنی اما تا تأیید، قابل استفاده نخواهد بود.',
    });
  }

  try {
    const safety = await checkContentSafety(trimmedContent);
    if (safety === 'unsafe') {
      return res.status(400).json({
        success: false,
        message: 'متن قصه شامل محتوایی است که برای کودکان مناسب نیست. لطفاً آن را ویرایش کنید.',
        code: 'content_unsafe',
      });
    }

    const [theme, emoji, geminiSuggestedAgeGroup] = await Promise.all([
      extractTheme(trimmedContent),
      extractEmoji(trimmedContent, trimmedTitle),
      suggestAgeGroup(trimmedContent, trimmedTitle),
    ]);

    res.json({
      success: true,
      gemini_available: true,
      safe: true,
      theme,
      emoji,
      gemini_suggested_age_group: geminiSuggestedAgeGroup,
    });
  } catch (err) {
    console.error('Parent story analysis failed:', err.message);
    res.json({
      success: true,
      gemini_available: false,
      message: 'سرویس بررسی هوش مصنوعی الان در دسترس نیست. می‌تونی قصه رو ذخیره کنی اما تا تأیید، قابل استفاده نخواهد بود.',
    });
  }
}

async function submitCustomText(req, res) {
  const { title, content, child_id: childId, age_group: ageGroup } = req.body || {};
  const validation = validateParentStoryInput(title, content);

  if (validation.error) {
    return res.status(validation.error.status).json(validation.error.body);
  }

  const { trimmedTitle, trimmedContent } = validation;

  if (!ageGroup || !VALID_AGE_GROUPS.includes(ageGroup)) {
    return res.status(400).json({
      success: false,
      message: 'گروه سنی قصه را انتخاب کنید',
      code: 'invalid_age_group',
    });
  }

  const parsedChildId = Number(childId);
  if (!Number.isInteger(parsedChildId) || parsedChildId <= 0) {
    return res.status(400).json({ success: false, message: 'child_id is required' });
  }

  const child = childModel.getById(parsedChildId);
  if (!child || child.user_id !== req.userId) {
    return res.status(403).json({ success: false, message: 'Child not found' });
  }

  let theme = 'قصه';
  let emoji = '📖';
  let approvalStatus = 'pending';
  let geminiSuggestedAgeGroup = null;

  if (isGeminiConfigured()) {
    try {
      const safety = await checkContentSafety(trimmedContent);
      if (safety === 'unsafe') {
        return res.status(400).json({
          success: false,
          message: 'متن قصه شامل محتوایی است که برای کودکان مناسب نیست. لطفاً آن را ویرایش کنید.',
          code: 'content_unsafe',
        });
      }

      const [extractedTheme, extractedEmoji, suggestedAge] = await Promise.all([
        extractTheme(trimmedContent),
        extractEmoji(trimmedContent, trimmedTitle),
        suggestAgeGroup(trimmedContent, trimmedTitle),
      ]);

      theme = extractedTheme;
      emoji = extractedEmoji;
      geminiSuggestedAgeGroup = suggestedAge;
      approvalStatus = 'approved';
    } catch (err) {
      console.error('Gemini unavailable during parent story save:', err.message);
    }
  }

  const saved = storyModel.createParentStory(
    trimmedTitle,
    trimmedContent,
    ageGroup,
    theme,
    emoji,
    req.userId,
    { approvalStatus, geminiSuggestedAgeGroup }
  );

  const pendingMessage =
    approvalStatus === 'pending'
      ? 'قصه‌ات ذخیره شد! وقتی سرویس بررسی در دسترس باشه، می‌تونی ازش استفاده کنی 🌙'
      : null;

  res.status(201).json({
    success: true,
    story: {
      id: saved.id,
      title: saved.title,
      emoji: saved.emoji,
      theme: saved.theme,
      age_group: saved.age_group,
      approval_status: saved.approval_status,
      gemini_suggested_age_group: saved.gemini_suggested_age_group,
    },
    pending_message: pendingMessage,
  });
}

async function generateCustom(req, res) {
  const { topic, age_group: ageGroup, child_id: childId } = req.body;

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return res.status(400).json({ success: false, message: 'topic is required' });
  }

  if (!ageGroup || !VALID_AGE_GROUPS.includes(ageGroup)) {
    return res.status(400).json({ success: false, message: 'Invalid age_group' });
  }

  const parsedChildId = Number(childId);
  if (!Number.isInteger(parsedChildId) || parsedChildId <= 0) {
    return res.status(400).json({ success: false, message: 'child_id is required' });
  }

  const child = childModel.getById(parsedChildId);
  if (!child || child.user_id !== req.userId) {
    return res.status(403).json({ success: false, message: 'Child not found' });
  }

  const todayCount = generationLog.getTodayCount(parsedChildId);
  if (todayCount >= generationLog.DAILY_CAP) {
    return res.status(429).json({ success: false, message: DAILY_LIMIT_MESSAGE });
  }

  try {
    const generated = await generateStory(topic.trim(), ageGroup);
    const saved = storyModel.createCustomStory(
      generated.title,
      generated.content,
      ageGroup,
      generated.theme || 'موضوع دلخواه',
      generated.emoji || '🌟'
    );

    generationLog.incrementToday(parsedChildId);
    const remaining = generationLog.getRemainingToday(parsedChildId);

    res.status(201).json({
      success: true,
      story: formatStory(saved),
      remaining_today: remaining,
    });
  } catch (err) {
    console.error('Custom story generation failed:', err.message);
    res.status(500).json({ success: false, message: 'مشکلی در ساخت قصه پیش آمد. لطفاً دوباره امتحان کن.' });
  }
}

function getStatus(_req, res) {
  const total = storyModel.getSeededCount();
  res.json({
    success: true,
    total_library_stories: total,
    ready: total >= LIBRARY_READY_MIN,
  });
}

async function generateAudio(req, res) {
  const id = Number(req.params.id);
  let { voice_id: voiceId } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid story id' });
  }

  const story = storyModel.getById(id);
  if (!story) {
    return res.status(404).json({ success: false, message: 'Story not found' });
  }

  if (story.submitted_by_user_id && story.approval_status === 'pending') {
    return res.status(403).json({
      success: false,
      message: 'این قصه هنوز تأیید نشده و نمی‌تونی صداش رو بسازی 🌙',
      code: 'story_pending',
    });
  }

  const userProfiles = voiceProfileModel.getByUserId(req.userId);
  if (!userProfiles.length) {
    voiceId = elevenLabs.DEFAULT_VOICE_ID;
  } else if (voiceId) {
    const owned = userProfiles.some((p) => p.elevenlabs_voice_id === voiceId);
    if (!owned) {
      voiceId = elevenLabs.DEFAULT_VOICE_ID;
    }
  } else {
    voiceId = elevenLabs.DEFAULT_VOICE_ID;
  }

  try {
    const audioUrl = await elevenLabs.getOrCreateStoryAudio(id, story.content, voiceId);

    if (story.audio_url !== audioUrl) {
      storyModel.updateAudioUrl(id, audioUrl);
    }

    res.json({ success: true, audio_url: audioUrl, voice_id: voiceId });
  } catch (err) {
    console.error('Audio generation failed:', err.message);
    res.status(500).json({ success: false, message: 'مشکلی در ساخت صدا پیش آمد. لطفاً دوباره امتحان کن.' });
  }
}

function getRemaining(req, res) {
  const childId = Number(req.query.child_id);

  if (!Number.isInteger(childId) || childId <= 0) {
    return res.status(400).json({ success: false, message: 'child_id is required' });
  }

  const child = childModel.getById(childId);
  if (!child || child.user_id !== req.userId) {
    return res.status(403).json({ success: false, message: 'Child not found' });
  }

  res.json({
    success: true,
    remaining_today: generationLog.getRemainingToday(childId),
    daily_cap: generationLog.DAILY_CAP,
  });
}

module.exports = {
  listStories,
  getStory,
  getStatus,
  generateCustom,
  analyzeCustomText,
  submitCustomText,
  generateAudio,
  getRemaining,
  DAILY_LIMIT_MESSAGE,
  LIBRARY_READY_MIN,
};
