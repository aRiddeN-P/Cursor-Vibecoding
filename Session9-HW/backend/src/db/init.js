const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number  TEXT    NOT NULL UNIQUE,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS children (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    birth_date    TEXT,
    age_group     TEXT    NOT NULL CHECK (age_group IN ('0-2', '3-5', '6-7')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS voice_profiles (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT    NOT NULL,
    elevenlabs_voice_id TEXT    NOT NULL,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    age_group   TEXT    NOT NULL CHECK (age_group IN ('0-2', '3-5', '6-7')),
    theme       TEXT,
    emoji       TEXT,
    audio_url   TEXT,
    is_custom   INTEGER NOT NULL DEFAULT 0,
    submitted_by_user_id INTEGER REFERENCES users(id),
    approval_status TEXT NOT NULL DEFAULT 'approved'
      CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    gemini_suggested_age_group TEXT
      CHECK (gemini_suggested_age_group IS NULL OR gemini_suggested_age_group IN ('0-2', '3-5', '6-7')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS story_generation_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id  INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    date      TEXT    NOT NULL,
    count     INTEGER NOT NULL DEFAULT 0,
    UNIQUE (child_id, date)
  );

  CREATE TABLE IF NOT EXISTS story_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id   INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    story_id   INTEGER REFERENCES stories(id) ON DELETE SET NULL,
    mode       TEXT    NOT NULL CHECK (mode IN ('calm', 'interactive')),
    started_at TEXT    NOT NULL DEFAULT (datetime('now')),
    ended_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS gemini_api_usage (
    date          TEXT    NOT NULL PRIMARY KEY,
    request_count INTEGER NOT NULL DEFAULT 0,
    token_count   INTEGER NOT NULL DEFAULT 0
  );
`;

function getDbPath() {
  return process.env.DATABASE_PATH || path.join(__dirname, '../../data/lalayi.db');
}

function ensureDataDir(dbPath) {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function initializeDatabase(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
}

function createDatabase() {
  const dbPath = getDbPath();
  ensureDataDir(dbPath);
  const db = new Database(dbPath);
  initializeDatabase(db);
  return db;
}

if (require.main === module) {
  const dbPath = getDbPath();
  const db = createDatabase();
  console.log(`Database initialized at ${dbPath}`);
  db.close();
}

module.exports = { createDatabase, initializeDatabase, getDbPath };
