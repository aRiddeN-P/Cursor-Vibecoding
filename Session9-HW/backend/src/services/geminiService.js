const DAILY_CAP = 5;
const geminiUsageTracker = require('./geminiUsageTracker');

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

function buildUserPrompt(topic, ageGroup) {
  return `Write a bedtime story about: "${topic}"
Age group: ${ageGroup}`;
}

async function callGeminiGenerateContent(body, { fallbackText = '' } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('Gemini API key is not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  geminiUsageTracker.recordGeminiUsage(data?.usageMetadata, { fallbackText });

  return data;
}

async function generateStory(topic, ageGroup) {
  const data = await callGeminiGenerateContent(
    {
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(ageGroup) }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: buildUserPrompt(topic, ageGroup) }],
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
    },
    { fallbackText: topic }
  );

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini API');
  }

  return JSON.parse(text);
}

async function geminiSimpleText(prompt) {
  const data = await callGeminiGenerateContent(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    },
    { fallbackText: prompt }
  );

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error('Empty response from Gemini API');
  }

  return text;
}

async function checkContentSafety(content) {
  const prompt = `Read the following Persian text intended for a young child. Does it contain any scary, violent, sexual, or otherwise inappropriate content for children under 7? Reply with only 'safe' or 'unsafe'.

Text:
${content}`;

  const result = await geminiSimpleText(prompt);
  return result.toLowerCase().includes('unsafe') ? 'unsafe' : 'safe';
}

async function extractTheme(content) {
  const prompt = `What is the main moral theme of this Persian children's story? Reply with a single Persian word only.

Story:
${content.slice(0, 2000)}`;

  const theme = await geminiSimpleText(prompt);
  return theme.replace(/["'.]/g, '').trim() || 'قصه';
}

const VALID_AGE_GROUPS = ['0-2', '3-5', '6-7'];

function isGeminiConfigured() {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey && apiKey !== 'your-gemini-api-key-here');
}

function normalizeAgeGroup(value) {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.trim();
  return VALID_AGE_GROUPS.find((group) => cleaned.includes(group)) || null;
}

async function suggestAgeGroup(content, title) {
  const prompt = `Read this Persian children's story titled "${title}".
Which age group is it most suitable for?
Reply with ONLY one of these exact values: 0-2, 3-5, 6-7

0-2 = babies and toddlers (very simple, short sentences)
3-5 = preschoolers (simple plot, gentle themes)
6-7 = early school age (slightly richer vocabulary and plot)

Story:
${content.slice(0, 2500)}`;

  const result = await geminiSimpleText(prompt);
  const normalized = normalizeAgeGroup(result);
  return VALID_AGE_GROUPS.includes(normalized) ? normalized : '3-5';
}

async function extractEmoji(content, title) {
  const prompt = `Choose one emoji that best represents this Persian children's story titled "${title}". Reply with only the emoji character.

Story excerpt:
${content.slice(0, 1000)}`;

  const emoji = await geminiSimpleText(prompt);
  const match = emoji.match(/\p{Extended_Pictographic}/u);
  return match ? match[0] : '📖';
}

module.exports = {
  generateStory,
  checkContentSafety,
  extractTheme,
  extractEmoji,
  suggestAgeGroup,
  isGeminiConfigured,
  normalizeAgeGroup,
  VALID_AGE_GROUPS,
  DAILY_CAP,
};
