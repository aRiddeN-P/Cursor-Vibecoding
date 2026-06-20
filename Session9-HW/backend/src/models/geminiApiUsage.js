const db = require('../db/connection');

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const getDaily = db.prepare(
  'SELECT request_count, token_count FROM gemini_api_usage WHERE date = ?'
);

const upsertDaily = db.prepare(`
  INSERT INTO gemini_api_usage (date, request_count, token_count)
  VALUES (?, 1, ?)
  ON CONFLICT(date) DO UPDATE SET
    request_count = request_count + 1,
    token_count = token_count + excluded.token_count
`);

function getDailyUsage(date = todayDateStr()) {
  const row = getDaily.get(date);
  return {
    request_count: row?.request_count || 0,
    token_count: row?.token_count || 0,
  };
}

function incrementDaily(tokenCount = 0) {
  upsertDaily.run(todayDateStr(), tokenCount);
}

module.exports = {
  getDailyUsage,
  incrementDaily,
  todayDateStr,
};
