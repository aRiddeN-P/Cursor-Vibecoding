const db = require('../db/connection');
const { DAILY_CAP } = require('../services/geminiService');

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const getLog = db.prepare(
  'SELECT id, child_id, date, count FROM story_generation_log WHERE child_id = ? AND date = ?'
);

const insertLog = db.prepare(
  'INSERT INTO story_generation_log (child_id, date, count) VALUES (?, ?, 1)'
);

const incrementLog = db.prepare(
  'UPDATE story_generation_log SET count = count + 1 WHERE child_id = ? AND date = ?'
);

function getTodayCount(childId) {
  const row = getLog.get(childId, todayDateStr());
  return row ? row.count : 0;
}

function getRemainingToday(childId) {
  return Math.max(0, DAILY_CAP - getTodayCount(childId));
}

function incrementToday(childId) {
  const date = todayDateStr();
  const existing = getLog.get(childId, date);

  if (existing) {
    incrementLog.run(childId, date);
    return existing.count + 1;
  }

  insertLog.run(childId, date);
  return 1;
}

module.exports = {
  DAILY_CAP,
  getTodayCount,
  getRemainingToday,
  incrementToday,
};
