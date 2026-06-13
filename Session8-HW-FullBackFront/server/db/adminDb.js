/**
 * adminDb.js
 * Connects to the admin-panel SQLite database (dakhlyar_admin.db).
 * This database is completely independent from the app database.
 * Never import appDb here.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
require('dotenv').config();

const ADMIN_DB_PATH = process.env.ADMIN_DB_PATH || './dakhlyar_admin.db';
const absolutePath = path.resolve(process.cwd(), ADMIN_DB_PATH);

const db = new Database(absolutePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at INTEGER NOT NULL
    );

    /* Phase 2 — onboarding stories */
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_index INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_admin_username ON admins(username);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_stories_active_order ON stories(is_active, order_index);

    /* Phase 13 — advertising banners */
    CREATE TABLE IF NOT EXISTS banners (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      title             TEXT    NOT NULL,
      image_path        TEXT    NOT NULL,
      link_url          TEXT    NOT NULL,
      link_type         TEXT    DEFAULT 'external',
      starts_at         TEXT    NOT NULL,
      ends_at           TEXT    NOT NULL,
      is_active         INTEGER DEFAULT 1,
      display_order     INTEGER DEFAULT 0,
      click_count       INTEGER DEFAULT 0,
      impression_count  INTEGER DEFAULT 0,
      created_at        TEXT    DEFAULT CURRENT_TIMESTAMP,
      updated_at        TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active, starts_at, ends_at, display_order);

    CREATE TABLE IF NOT EXISTS banner_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      banner_id  INTEGER NOT NULL,
      event_type TEXT    NOT NULL CHECK (event_type IN ('impression', 'click')),
      created_at TEXT    DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (banner_id) REFERENCES banners(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_banner_events_day
      ON banner_events(event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_banner_events_banner
      ON banner_events(banner_id, created_at);

    /* Phase 14-A — admin activity log */
    CREATE TABLE IF NOT EXISTS admin_activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT DEFAULT NULL,
      target_id INTEGER DEFAULT NULL,
      detail TEXT DEFAULT NULL,
      ip_address TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_id, created_at);
  `);

  migrateAdminColumns();
  migrateBannerEvents();
}

function migrateBannerEvents() {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='banner_events'"
  ).all();
  if (!tables.length) return;

  const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM banner_events').get();
  if (cnt > 0) return;

  const banners = db.prepare(`
    SELECT id, impression_count, click_count FROM banners
    WHERE impression_count > 0 OR click_count > 0
  `).all();
  if (!banners.length) return;

  const insert = db.prepare(
    'INSERT INTO banner_events (banner_id, event_type) VALUES (?, ?)'
  );
  const trx = db.transaction(() => {
    for (const b of banners) {
      for (let i = 0; i < (b.impression_count || 0); i += 1) {
        insert.run(b.id, 'impression');
      }
      for (let i = 0; i < (b.click_count || 0); i += 1) {
        insert.run(b.id, 'click');
      }
    }
  });
  trx();
}

function migrateAdminColumns() {
  const cols = db.prepare('PRAGMA table_info(admins)').all().map((c) => c.name);
  if (!cols.includes('must_change_password')) {
    db.exec('ALTER TABLE admins ADD COLUMN must_change_password INTEGER DEFAULT 0');
  }
  if (!cols.includes('last_login')) {
    db.exec('ALTER TABLE admins ADD COLUMN last_login TEXT DEFAULT NULL');
  }
}

function seedDefaultAdmin() {
  const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM admins').get();
  if (cnt > 0) return;

  const passwordHash = bcrypt.hashSync('admin', 12);
  db.prepare(
    `INSERT INTO admins (username, email, password_hash, role, is_active, must_change_password)
     VALUES (?, ?, ?, 'superadmin', 1, 1)`
  ).run('admin', 'admin@dakhlyar.ir', passwordHash);
}

/**
 * Ensure a valid placeholder.jpg exists under server/uploads/stories/.
 * A tiny 1x1 white JPEG (~134 bytes) is shipped inline as base64 so the
 * onboarding flow works immediately without requiring any uploads.
 */
function ensurePlaceholderImage() {
  const uploadsDir = path.resolve(__dirname, '..', 'uploads', 'stories');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const placeholderPath = path.join(uploadsDir, 'placeholder.jpg');
  if (!fs.existsSync(placeholderPath)) {
    // Minimal valid 1x1 white JPEG (browsers will stretch to fit).
    const TINY_JPEG_BASE64 =
      '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB' +
      'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/2wBDAQEBAQEBAQEBAQEBAQEB' +
      'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEI' +
      'AAEAAQMBIgACEQEDEQH/xAAVAAEBAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAA' +
      'AAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwD' +
      'AQACEQMRAD8AVN//2Q==';
    fs.writeFileSync(placeholderPath, Buffer.from(TINY_JPEG_BASE64, 'base64'));
  }
}

/**
 * Seed 3 placeholder stories so the player works immediately.
 * Only runs if the stories table is empty.
 */
function seedStories() {
  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM stories').get();
  if (cnt > 0) return;

  const insert = db.prepare(
    'INSERT INTO stories (order_index, image_path, is_active) VALUES (?, ?, 1)'
  );
  const trx = db.transaction(() => {
    insert.run(1, '/uploads/stories/placeholder.jpg');
    insert.run(2, '/uploads/stories/placeholder.jpg');
    insert.run(3, '/uploads/stories/placeholder.jpg');
  });
  trx();
}

initialize();
ensurePlaceholderImage();
seedStories();
seedDefaultAdmin();

module.exports = db;
module.exports.path = absolutePath;
