const db = require('../db/connection');

const findByUserId = db.prepare(
  'SELECT id, user_id, name, birth_date, age_group, created_at FROM children WHERE user_id = ? ORDER BY created_at ASC'
);
const findById = db.prepare('SELECT * FROM children WHERE id = ?');
const create = db.prepare(
  'INSERT INTO children (user_id, name, birth_date, age_group) VALUES (?, ?, ?, ?)'
);

function getByUserId(userId) {
  return findByUserId.all(userId);
}

function getById(id) {
  return findById.get(id);
}

function createChild(userId, name, birthDate, ageGroup) {
  const result = create.run(userId, name, birthDate, ageGroup);
  return findById.get(result.lastInsertRowid);
}

module.exports = { getByUserId, getById, createChild };
