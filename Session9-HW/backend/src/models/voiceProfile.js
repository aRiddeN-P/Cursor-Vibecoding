const db = require('../db/connection');

const listByUserId = db.prepare(`
  SELECT id, user_id, name, elevenlabs_voice_id, created_at
  FROM voice_profiles
  WHERE user_id = ?
  ORDER BY created_at ASC
`);

const findById = db.prepare('SELECT * FROM voice_profiles WHERE id = ?');

const insert = db.prepare(`
  INSERT INTO voice_profiles (user_id, name, elevenlabs_voice_id)
  VALUES (?, ?, ?)
`);

const remove = db.prepare('DELETE FROM voice_profiles WHERE id = ?');

function getByUserId(userId) {
  return listByUserId.all(userId);
}

function getById(id) {
  return findById.get(id);
}

function create(userId, name, elevenlabsVoiceId) {
  const result = insert.run(userId, name, elevenlabsVoiceId);
  return findById.get(result.lastInsertRowid);
}

function deleteById(id) {
  return remove.run(id).changes;
}

module.exports = { getByUserId, getById, create, deleteById };
