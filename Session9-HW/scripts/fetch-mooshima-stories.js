#!/usr/bin/env node
/**
 * Fetches Persian children's stories from mooshima.com, enriches with Gemini,
 * and saves to the stories table (is_custom = false).
 *
 * Usage (from project root):
 *   node scripts/fetch-mooshima-stories.js
 *
 * Requires GEMINI_API_KEY in backend/.env
 */

const path = require('path');

const backendDir = path.join(__dirname, '../backend');

require(path.join(backendDir, 'node_modules/dotenv')).config({
  path: path.join(backendDir, '.env'),
});

const cheerio = require(path.join(backendDir, 'node_modules/cheerio'));
const storyModel = require(path.join(backendDir, 'src/models/story'));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DELAY_MS = Number(process.env.MOOSHIMA_SCRAPE_DELAY_MS) || 1500;
const LISTING_URL = 'https://mooshima.com/mag/c/kids-channel/stories/';
const TARGET_PER_GROUP = 10;
const TARGET_TOTAL = 30;
const AGE_GROUPS = ['0-2', '3-5', '6-7'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function geminiText(prompt, { json = false } = {}) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4 },
  };

  if (json) {
    body.generationConfig.responseMimeType = 'application/json';
  }

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
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

async function classifyAgeGroup(storyText) {
  const prompt = `Read the following Persian children's story and classify it into one of these age groups: '0-2' (very simple, short sentences, basic vocabulary), '3-5' (light moral lesson, simple plot), '6-7' (richer characters, broader vocabulary). Reply with only the age group string, nothing else.

Story:
${storyText.slice(0, 3000)}`;

  const result = await geminiText(prompt);
  const normalized = result.replace(/['"]/g, '').trim();
  if (AGE_GROUPS.includes(normalized)) return normalized;
  if (normalized.includes('0-2')) return '0-2';
  if (normalized.includes('6-7')) return '6-7';
  return '3-5';
}

async function extractThemeAndEmoji(storyText, title) {
  const prompt = `For this Persian children's story titled "${title}", return JSON only:
{"theme":"one or two Persian words e.g. صداقت","emoji":"single emoji"}

Story excerpt:
${storyText.slice(0, 1500)}`;

  try {
    const raw = await geminiText(prompt, { json: true });
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme || 'قصه',
      emoji: parsed.emoji || '📖',
    };
  } catch {
    return { theme: 'قصه', emoji: '📖' };
  }
}

async function expandStory(storyText) {
  const prompt = `The following is a short Persian children's story. Please expand it to 150-200 words while keeping the same characters, gentle tone, and age-appropriate language. Do not add scary or violent elements. Keep the ending warm and positive. Return only the expanded story text in Persian.

Story:
${storyText}`;

  return geminiText(prompt);
}

async function closeStory(storyText) {
  const prompt = `The following Persian children's story may end abruptly. Add a short warm 2-3 sentence closing in Persian that resolves the story positively. Return the FULL story (original + new closing) as one text in Persian.

Story:
${storyText}`;

  return geminiText(prompt);
}

async function generateFillInStory(ageGroup, themeHint) {
  const prompt = `Write an original soothing Persian bedtime story for age group ${ageGroup} about "${themeHint}".
150-200 words. No scary content. Warm positive ending.
Return JSON only: {"title":"...","content":"...","theme":"...","emoji":"..."}`;

  const raw = await geminiText(prompt, { json: true });
  return JSON.parse(raw);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'LalayiStoryBot/1.0 (educational; contact: local-dev)',
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

function extractStoryLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    let absolute;
    try {
      absolute = new URL(href, baseUrl).href;
    } catch {
      return;
    }

    if (!absolute.includes('mooshima.com')) return;
    if (absolute.includes('/kids-channel/stories')) return;
    if (absolute.includes('/mag/') && !absolute.endsWith('/stories/')) {
      links.add(absolute.split('#')[0]);
    }
  });

  return [...links];
}

function extractStoryPage(html) {
  const $ = cheerio.load(html);

  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').text().trim();

  const ageHint =
    $('.age, .age-group, [class*="age"]').first().text().trim() ||
    $('meta[name="description"]').attr('content') ||
    '';

  const contentSelectors = [
    '.entry-content',
    '.post-content',
    'article .content',
    'article',
    '.single-content',
    'main',
  ];

  let content = '';
  for (const selector of contentSelectors) {
    const el = $(selector).first();
    if (el.length) {
      el.find('script, style, nav, .share, .related').remove();
      content = el
        .text()
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (wordCount(content) >= 40) break;
    }
  }

  return { title, content, ageHint };
}

async function collectStoryUrls() {
  const urls = new Set();
  let page = 1;
  const maxPages = 20;

  while (page <= maxPages) {
    const pageUrl = page === 1 ? LISTING_URL : `${LISTING_URL}page/${page}/`;

    try {
      console.log(`Scanning listing page ${page}...`);
      const html = await fetchHtml(pageUrl);
      const found = extractStoryLinks(html, pageUrl);

      if (!found.length) break;

      const before = urls.size;
      found.forEach((u) => urls.add(u));
      if (urls.size === before) break;

      page += 1;
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`Listing page ${page} failed: ${err.message}`);
      break;
    }
  }

  return [...urls];
}

async function processStory(url, index) {
  const html = await fetchHtml(url);
  let { title, content, ageHint } = extractStoryPage(html);

  if (!title || wordCount(content) < 20) {
    throw new Error('Could not extract title or content');
  }

  if (storyModel.hasTitle(title)) {
    throw new Error('Story already exists');
  }

  if (wordCount(content) < 100) {
    content = await expandStory(content);
    await sleep(DELAY_MS);
  }

  if (!/[.!؟…]["']?\s*$/.test(content.trim()) && wordCount(content) < 180) {
    content = await closeStory(content);
    await sleep(DELAY_MS);
  }

  let ageGroup = null;
  const ageMatch = ageHint.match(/0-2|3-5|6-7|۰-۲|۳-۵|۶-۷/);
  if (ageMatch) {
    const map = { '۰-۲': '0-2', '۳-۵': '3-5', '۶-۷': '6-7' };
    ageGroup = map[ageMatch[0]] || ageMatch[0];
  }

  if (!ageGroup) {
    ageGroup = await classifyAgeGroup(content);
    await sleep(DELAY_MS);
  }

  const { theme, emoji } = await extractThemeAndEmoji(content, title);
  await sleep(DELAY_MS);

  storyModel.createStory(title, content, ageGroup, theme, emoji, false);
  console.log(`Fetching story [${index}]: ${title} (${ageGroup})`);
}

async function fillShortage() {
  const fillThemes = {
    '0-2': ['ستاره شب', 'خرگوش کوچولو', 'ماه ملایم', 'باران آرام', 'گل صورتی'],
    '3-5': ['مهربانی', 'دوستی', 'راستگویی', 'شجاعت', 'سخاوت'],
    '6-7': ['ماجراجویی آرام', 'کشف طبیعت', 'همکاری', 'خلاقیت', 'امید'],
  };

  for (const ageGroup of AGE_GROUPS) {
    while (storyModel.getSeededCountByAgeGroup(ageGroup) < TARGET_PER_GROUP) {
      const n = storyModel.getSeededCountByAgeGroup(ageGroup) + 1;
      const themeHint = fillThemes[ageGroup][n % fillThemes[ageGroup].length];

      console.log(`Generating fill-in story for ${ageGroup}: ${themeHint}`);
      const generated = await generateFillInStory(ageGroup, themeHint);
      await sleep(DELAY_MS);

      storyModel.createStory(
        generated.title,
        generated.content,
        ageGroup,
        generated.theme || themeHint,
        generated.emoji || '🌟',
        false
      );
    }
  }
}

async function main() {
  console.log('Mooshima story fetch starting...');

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
    console.error('GEMINI_API_KEY is required in backend/.env');
    process.exit(1);
  }

  let urls = [];
  try {
    urls = await collectStoryUrls();
    console.log(`Found ${urls.length} candidate story URLs`);
  } catch (err) {
    console.error(`Failed to collect URLs: ${err.message}`);
  }

  let index = storyModel.getSeededCount() + 1;

  for (const url of urls) {
    if (storyModel.getSeededCount() >= TARGET_TOTAL) break;

    try {
      await processStory(url, index);
      index += 1;
    } catch (err) {
      console.error(`Skipped ${url}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  if (storyModel.getSeededCount() < TARGET_TOTAL) {
    console.log('Filling shortages with Gemini-generated stories...');
    await fillShortage();
  }

  storyModel.renumberSeededStories();

  const total = storyModel.getSeededCount();
  console.log(`\nDone. Library now has ${total} stories.`);
  for (const g of AGE_GROUPS) {
    console.log(`  ${g}: ${storyModel.getSeededCountByAgeGroup(g)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
