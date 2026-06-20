const db = require('../db/connection');

const findByPhone = db.prepare('SELECT * FROM users WHERE phone_number = ?');
const findById = db.prepare('SELECT * FROM users WHERE id = ?');
const create = db.prepare('INSERT INTO users (phone_number) VALUES (?)');

function getByPhone(phoneNumber) {
  return findByPhone.get(phoneNumber);
}

function createUser(phoneNumber) {
  const result = create.run(phoneNumber);
  return findById.get(result.lastInsertRowid);
}

module.exports = { getByPhone, createUser };
