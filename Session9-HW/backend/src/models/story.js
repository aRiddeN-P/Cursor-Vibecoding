const db = require('../db/connection');

const listByAgeGroup = db.prepare(`
  SELECT id, title, emoji, theme, age_group, approval_status, gemini_suggested_age_group
  FROM stories
  WHERE age_group = ? AND is_custom = 0
  ORDER BY id ASC
`);

const listByParent = db.prepare(`
  SELECT id, title, emoji, theme, age_group, approval_status, gemini_suggested_age_group
  FROM stories
  WHERE age_group = ? AND submitted_by_user_id = ?
  ORDER BY created_at DESC
`);

const listAllByParent = db.prepare(`
  SELECT id, title, emoji, theme, age_group, approval_status, gemini_suggested_age_group
  FROM stories
  WHERE submitted_by_user_id = ?
  ORDER BY created_at DESC
`);

const findById = db.prepare(`
  SELECT id, title, content, age_group, theme, emoji, audio_url, is_custom,
         submitted_by_user_id, approval_status, gemini_suggested_age_group, created_at
  FROM stories
  WHERE id = ?
`);

const insert = db.prepare(`
  INSERT INTO stories (title, content, age_group, theme, emoji, is_custom)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertParentStory = db.prepare(`
  INSERT INTO stories (
    title, content, age_group, theme, emoji, is_custom,
    submitted_by_user_id, approval_status, gemini_suggested_age_group
  )
  VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
`);

const deleteSeeded = db.prepare('DELETE FROM stories WHERE is_custom = 0');
const countSeeded = db.prepare('SELECT COUNT(*) AS n FROM stories WHERE is_custom = 0');
const countByAgeGroup = db.prepare(
  'SELECT COUNT(*) AS n FROM stories WHERE age_group = ? AND is_custom = 0'
);
const findByTitle = db.prepare(
  'SELECT id FROM stories WHERE title = ? AND is_custom = 0 LIMIT 1'
);

function getByAgeGroup(ageGroup) {
  return listByAgeGroup.all(ageGroup);
}

function getByParentUser(ageGroup, userId) {
  return listByParent.all(ageGroup, userId);
}

function getAllByParentUser(userId) {
  return listAllByParent.all(userId);
}

const listPendingByParent = db.prepare(`
  SELECT id, title, content
  FROM stories
  WHERE submitted_by_user_id = ? AND approval_status = 'pending'
`);

const approveParentStory = db.prepare(`
  UPDATE stories
  SET approval_status = 'approved', theme = ?, emoji = ?, gemini_suggested_age_group = ?
  WHERE id = ?
`);

function getPendingByParentUser(userId) {
  return listPendingByParent.all(userId);
}

function markParentStoryApproved(id, theme, emoji, geminiSuggestedAgeGroup) {
  approveParentStory.run(theme, emoji, geminiSuggestedAgeGroup, id);
}

function getById(id) {
  return findById.get(id);
}

function createStory(title, content, ageGroup, theme, emoji, isCustom = false) {
  const result = insert.run(title, content, ageGroup, theme, emoji, isCustom ? 1 : 0);
  return findById.get(result.lastInsertRowid);
}

function createCustomStory(title, content, ageGroup, theme, emoji) {
  return createStory(title, content, ageGroup, theme, emoji, true);
}

function createParentStory(
  title,
  content,
  ageGroup,
  theme,
  emoji,
  userId,
  { approvalStatus = 'approved', geminiSuggestedAgeGroup = null } = {}
) {
  const result = insertParentStory.run(
    title,
    content,
    ageGroup,
    theme,
    emoji,
    userId,
    approvalStatus,
    geminiSuggestedAgeGroup
  );
  return findById.get(result.lastInsertRowid);
}

function updateAudioUrl(id, audioUrl) {
  db.prepare('UPDATE stories SET audio_url = ? WHERE id = ?').run(audioUrl, id);
  return findById.get(id);
}

function getSeededCount() {
  return countSeeded.get().n;
}

function getSeededCountByAgeGroup(ageGroup) {
  return countByAgeGroup.get(ageGroup).n;
}

function hasTitle(title) {
  return Boolean(findByTitle.get(title));
}

function clearSeededStories() {
  const changes = deleteSeeded.run().changes;
  db.exec("DELETE FROM sqlite_sequence WHERE name='stories'");
  return changes;
}

function renumberSeededStories() {
  const stories = db
    .prepare(
      `SELECT title, content, age_group, theme, emoji
       FROM stories WHERE is_custom = 0 ORDER BY id ASC`
    )
    .all();

  const renumber = db.transaction(() => {
    deleteSeeded.run();
    db.exec("DELETE FROM sqlite_sequence WHERE name='stories'");
    for (const story of stories) {
      insert.run(story.title, story.content, story.age_group, story.theme, story.emoji, 0);
    }
  });

  renumber();
  return stories.length;
}

module.exports = {
  getByAgeGroup,
  getByParentUser,
  getAllByParentUser,
  getPendingByParentUser,
  markParentStoryApproved,
  getById,
  createStory,
  createCustomStory,
  createParentStory,
  updateAudioUrl,
  getSeededCount,
  getSeededCountByAgeGroup,
  hasTitle,
  clearSeededStories,
  renumberSeededStories,
};
