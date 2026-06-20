const storyModel = require('../models/story');

const LIBRARY_READY_MIN = 30;

function checkStoryLibrary() {
  const total = storyModel.getSeededCount();

  if (total < LIBRARY_READY_MIN) {
    console.warn(
      `⚠️  Story library has only ${total} stories. Run: node scripts/fetch-mooshima-stories.js`
    );
  } else {
    console.log(`✅ Story library ready: ${total} stories loaded`);
  }

  return total;
}

module.exports = { checkStoryLibrary, LIBRARY_READY_MIN };
