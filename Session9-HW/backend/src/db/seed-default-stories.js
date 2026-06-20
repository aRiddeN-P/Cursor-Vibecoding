const path = require('path');
const fs = require('fs');
const storyModel = require('../models/story');

const DEFAULT_STORIES_PATH = path.join(__dirname, 'default-stories.json');
const EXPECTED_COUNT = 30;

function loadDefaultStories() {
  if (!fs.existsSync(DEFAULT_STORIES_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(DEFAULT_STORIES_PATH, 'utf8'));
}

function seedDefaultStories() {
  const stories = loadDefaultStories();
  if (!stories?.length) {
    console.warn('default-stories.json not found — skipping default story seed.');
    return 0;
  }

  const existingTitles = new Set(
    storyModel
      .getByAgeGroup('0-2')
      .concat(storyModel.getByAgeGroup('3-5'), storyModel.getByAgeGroup('6-7'))
      .map((s) => s.title)
  );

  let inserted = 0;
  for (const story of stories) {
    if (existingTitles.has(story.title)) continue;
    storyModel.createStory(
      story.title,
      story.content,
      story.age_group,
      story.theme,
      story.emoji
    );
    inserted += 1;
  }

  if (inserted > 0) {
    storyModel.renumberSeededStories();
  }

  return inserted;
}

function ensureDefaultStories() {
  const count = storyModel.getSeededCount();
  if (count >= EXPECTED_COUNT) return count;

  const inserted = seedDefaultStories();
  const total = storyModel.getSeededCount();

  if (inserted > 0) {
    console.log(`Loaded ${inserted} default stories (${total}/${EXPECTED_COUNT} total).`);
  }

  return total;
}

module.exports = { ensureDefaultStories, seedDefaultStories, EXPECTED_COUNT };
