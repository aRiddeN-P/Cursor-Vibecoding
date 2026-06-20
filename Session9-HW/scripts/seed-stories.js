#!/usr/bin/env node
/**
 * Seeds 30 Persian bedtime stories via the Gemini API (10 per age group).
 *
 * Usage (from project root):
 *   node scripts/seed-stories.js
 *
 * Requires GEMINI_API_KEY in backend/.env
 */

const path = require('path');

const backendDir = path.join(__dirname, '../backend');

require(path.join(backendDir, 'node_modules/dotenv')).config({
  path: path.join(backendDir, '.env'),
});

const storyModel = require(path.join(backendDir, 'src/models/story'));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DELAY_MS = 1000;

const STORY_TOPICS = [
  // 0-2 — very simple, heavy repetition, short sentences
  { age_group: '0-2', topic: 'خرگوش کوچولویی که شب بخیر می‌گوید', theme: 'آرامش' },
  { age_group: '0-2', topic: 'ستاره‌های کوچک آسمانی', theme: 'خواب شیرین' },
  { age_group: '0-2', topic: 'برف نرم و سفید', theme: 'آرامش' },
  { age_group: '0-2', topic: 'ماهی کوچولو در آب آبی', theme: 'آب بازی' },
  { age_group: '0-2', topic: 'گل صورتی باغچه', theme: 'طبیعت' },
  { age_group: '0-2', topic: 'خرس عروسکی نرم', theme: 'عشق' },
  { age_group: '0-2', topic: 'باران آرام و ملایم', theme: 'آرامش' },
  { age_group: '0-2', topic: 'پرنده کوچولوی آبی', theme: 'آزادی' },
  { age_group: '0-2', topic: 'ابر پفیزی سفید', theme: 'شادی' },
  { age_group: '0-2', topic: 'شب بخیر مامان و بابا', theme: 'خانواده' },

  // 3-5 — light plot, gentle moral, simple arc
  { age_group: '3-5', topic: 'خرگوشی که راستگو بود', theme: 'راستگویی' },
  { age_group: '3-5', topic: 'گربه‌ای که به دوستش کمک کرد', theme: 'کمک به دیگران' },
  { age_group: '3-5', topic: 'درخت دوستی در پارک', theme: 'دوستی' },
  { age_group: '3-5', topic: 'ستاره‌ای که دوباره درخشید', theme: 'امید' },
  { age_group: '3-5', topic: 'خرسی که اسباب‌بازی‌اش را قسمت کرد', theme: 'سخاوت' },
  { age_group: '3-5', topic: 'جوجه‌ای که یاد گرفت پرواز کند', theme: 'تلاش' },
  { age_group: '3-5', topic: 'لاک‌پشت صبور', theme: 'صبر' },
  { age_group: '3-5', topic: 'پروانه رنگین‌کمانی', theme: 'زیبایی' },
  { age_group: '3-5', topic: 'ماهی و سنگ صبور کنار رودخانه', theme: 'گوش دادن' },
  { age_group: '3-5', topic: 'جادوی یک لبخند', theme: 'مهربانی' },

  // 6-7 — richer characters, complication and resolution
  { age_group: '6-7', topic: 'سفر شبانه به جنگل مهتابی', theme: 'ماجراجویی آرام' },
  { age_group: '6-7', topic: 'قهرمان کوچک روستای کوهستانی', theme: 'شجاعت' },
  { age_group: '6-7', topic: 'راز دریاچه آرام', theme: 'کنجکاوی' },
  { age_group: '6-7', topic: 'دوستی روباه و کلاغ', theme: 'پذیرش تفاوت‌ها' },
  { age_group: '6-7', topic: 'نجات باغ معلق', theme: 'همکاری' },
  { age_group: '6-7', topic: 'نقشه ستاره‌ای گم‌شده', theme: 'پشتکار' },
  { age_group: '6-7', topic: 'پلی که مهربانی ساخت', theme: 'مهربانی' },
  { age_group: '6-7', topic: 'ساعت جادویی قدردانی', theme: 'قدردانی' },
  { age_group: '6-7', topic: 'جزیره آرامش در میان ابرها', theme: 'آرامش درونی' },
  { age_group: '6-7', topic: 'پیدا کردن صدای موسیقی شب', theme: 'خلاقیت' },
];

const AGE_GROUP_GUIDANCE = {
  '0-2': `Target age: 0–2 years.
- Use very simple Persian with heavy repetition of key phrases and sounds.
- Short sentences (3–8 words each).
- Basic vocabulary: animals, colors, family, sleep, nature.
- No plot complexity — gentle, rhythmic, lullaby-like flow.`,

  '3-5': `Target age: 3–5 years.
- Simple but complete narrative arc: beginning, middle, end.
- Include a light, gentle moral lesson woven naturally into the story.
- Slightly longer sentences than toddler stories, but still easy to follow.
- Warm characters children can relate to.`,

  '6-7': `Target age: 6–7 years.
- Richer characters with distinct personalities.
- Include a small narrative complication and a calm, satisfying resolution.
- Broader vocabulary while keeping a soothing bedtime tone.
- Story should feel like a mini adventure that ends peacefully.`,
};

const BASE_SYSTEM_PROMPT = `You are a beloved Persian children's bedtime storyteller for the Lalayi (لالایی) app.

Write original stories in Persian (Farsi) only.

Strict rules:
- NO scary, violent, or anxiety-inducing content — no monsters, nightmares, danger, loss, or crying crises.
- Calm, soothing tone perfect for bedtime.
- End with a positive message or gentle moral lesson.
- Length: 150–250 Persian words.
- Return ONLY valid JSON with this exact shape:
  {"title": "...", "content": "...", "theme": "...", "emoji": "..."}
- "title": a short, warm Persian title.
- "content": the full story text in Persian.
- "theme": one or two Persian words for the story theme (e.g. "مهربانی", "راستگویی").
- "emoji": exactly one relevant emoji representing the story.`;

function buildSystemPrompt(ageGroup) {
  return `${BASE_SYSTEM_PROMPT}\n\n${AGE_GROUP_GUIDANCE[ageGroup]}`;
}

function buildUserPrompt(topic, theme, ageGroup) {
  return `Write a bedtime story about: "${topic}"
Suggested theme: ${theme}
Age group: ${ageGroup}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateStory(topic, theme, ageGroup) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(ageGroup) }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: buildUserPrompt(topic, theme, ageGroup) }],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            theme: { type: 'string' },
            emoji: { type: 'string' },
          },
          required: ['title', 'content', 'theme', 'emoji'],
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Gemini API error ${response.status}: ${errText}`);
    err.status = response.status;
    err.body = errText;
    throw err;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini API');
  }

  return JSON.parse(text);
}

function parseRetrySeconds(err) {
  try {
    const parsed = JSON.parse(err.body);
    const retry = parsed?.error?.details?.find((d) => d['@type']?.includes('RetryInfo'));
    if (retry?.retryDelay) {
      return Math.ceil(parseFloat(String(retry.retryDelay).replace('s', ''))) + 1;
    }
  } catch {
    // ignore
  }
  const match = String(err.message).match(/retry in ([\d.]+)s/i);
  return match ? Math.ceil(Number(match[1])) + 1 : 60;
}

async function generateStoryWithRetry(topic, theme, ageGroup) {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await generateStory(topic, theme, ageGroup);
    } catch (err) {
      if (err.status === 429 && attempt < maxAttempts) {
        const waitSec = parseRetrySeconds(err);
        console.log(`  Rate limited — waiting ${waitSec}s before retry ${attempt + 1}/${maxAttempts}...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
    console.error('Error: Set GEMINI_API_KEY in backend/.env before running this script.');
    process.exit(1);
  }

  const fresh = process.argv.includes('--fresh');
  const startFrom = Number(process.argv.find((a) => a.startsWith('--from='))?.split('=')[1]) || 0;

  if (fresh) {
    const removed = storyModel.clearSeededStories();
    if (removed > 0) {
      console.log(`Cleared ${removed} existing seeded stories.\n`);
    }
  } else {
    const existing = storyModel.getSeededCount();
    if (existing > 0) {
      console.log(`Resuming — ${existing} stories already in database.\n`);
    }
  }

  const total = STORY_TOPICS.length;
  const startIndex = Math.max(startFrom, fresh ? 0 : storyModel.getSeededCount());
  console.log(`Generating stories ${startIndex + 1}–${total} of ${total} with ${GEMINI_MODEL}...\n`);

  for (let i = startIndex; i < total; i++) {
    const { age_group, topic, theme } = STORY_TOPICS[i];
    const index = i + 1;

    try {
      const generated = await generateStoryWithRetry(topic, theme, age_group);
      const saved = storyModel.createStory(
        generated.title,
        generated.content,
        age_group,
        generated.theme || theme,
        generated.emoji || '🌙'
      );

      console.log(`Story ${index} of ${total} generated: ${saved.title}`);
    } catch (err) {
      console.error(`Story ${index} of ${total} failed (${topic}): ${err.message}`);
      process.exitCode = 1;
    }

    if (i < total - 1) {
      await sleep(DELAY_MS);
    }
  }

  storyModel.renumberSeededStories();
  console.log('\nSeeding complete. Story IDs reset to start at 1.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
